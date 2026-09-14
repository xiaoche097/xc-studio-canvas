import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import CreativeImageModelSelector from './image-models/CreativeImageModelSelector';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Crop,
  Download,
  Eye,
  Image as ImageIcon,
  Loader2,
  Maximize,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Shirt,
  Sun,
  Trash2,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import { generateImageToImage, generateText, compressImage } from '../services/geminiService';
import { getErrorMessage, isAbortError } from '../utils/apiHelpers';
import { AspectRatio, ImageResolution } from '../types';
import { applyColorCorrection, ColorCorrectionMode, createModelHeadIdentityCrop } from '../utils/imageProcessor';
import { convertImageDataUrlFormat, getImageDownloadExtension, OutputImageFormat } from '../utils/imageFormat';
import { downloadImageFile, fetchImageBlob } from '../utils/imageDownload';
import { saveGeneratedProject } from '../../services/projectHistoryService';
import { useImagePaste } from '../hooks/useImagePaste';
import ImageCropModal from './ImageCropModal';
import { ECOMMERCE_RATIOS } from '../constants/ecommerceHeroPresets';
import {
  CROP_FRAMING_OPTIONS,
  cropFramingById,
  type CropFramingId,
} from '../constants/cropFramingPresets';

// ==================== Types & Interfaces ====================

type UploadKind = 'model' | 'clothing' | 'scene';
type BoardType = 'main' | 'aplus' | 'social' | 'story' | 'asset' | 'mobile';
type GenerationStatus = 'pending' | 'submitting' | 'polling' | 'processing' | 'done' | 'error' | 'cancelled';
type TransferCheckpoint = 'input' | 'analyzed' | 'confirmed' | 'complete';
export type HDStep = 'input' | 'analyzing' | 'color' | 'line' | 'upscaling' | 'complete';

export type UploadedImage = {
  id: string;
  preview: string;
  base64: string;
  mime: string;
  name: string;
};

type AgentAnalysis = {
  identityBrief: string;
  lightingBrief: string;
  gazeAndPoseAnalysis?: string;
  transferSourceOutfit: boolean;
  outfitReason: string;
  lightingQuality: 'perfect' | 'good' | 'warning';
  lightingAnalysis: string;
  faceQuality: 'excellent' | 'adequate' | 'need_better_photo';
  faceRecommendation: string;
  isReadyToGenerate: boolean;
  generatedPrompt: string;
};

type PreparedScene = {
  scene: UploadedImage;
};

type ResultItem = {
  id: string;
  sceneId: string;
  sceneName: string;
  imageUrl: string | null;
  status: GenerationStatus;
  prompt: string;
  error?: string;
};

export interface ModelTransferRecord {
  id: string;
  createdAt: number;
  step: HDStep;
  checkpoint: TransferCheckpoint;
  oneClick: boolean;
  sourceModels: UploadedImage[];
  clothingImages: UploadedImage[];
  targetScenes: UploadedImage[];
  selectedModel: string;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
  outputFormat: OutputImageFormat;
  colorCorrectionMode: ColorCorrectionMode;
  colorCorrectionBlend: number;
  whiteBaseOutfit: boolean;
  boardType: BoardType;
  cropFraming: CropFramingId;
  modelHeight: string;
  outputCount: number;
  extraNotes: string;
  agentAnalysis: AgentAnalysis | null;
  results: ResultItem[];
  error: string | null;
  isGenerating?: boolean;
  statusMessage?: string;
}

const MAX_RECORDS = 20;
const MODEL_SLOTS = ['正面', '侧面', '微侧'] as const;
const MAX_MODEL_IMAGES = 3;
const MAX_CLOTHING_IMAGES = 1;
const MAX_SCENE_IMAGES = 10;

const SCENE_BOARD_CONFIGS: Record<BoardType, { label: string; description: string; icon: string }> = {
  main: { label: '副图', description: '电商主副图场景，适合卖点强化与点击转化', icon: '🛒' },
  aplus: { label: 'A+', description: '详情页横幅场景，适合叙事展示与品牌表达', icon: '✨' },
  social: { label: '社媒买家秀', description: '真实生活化使用场景，适合种草与社媒传播', icon: '📱' },
  story: { label: '品牌故事', description: '电影感品牌场景，适合展示人物与空间氛围', icon: '🎬' },
  asset: { label: '复刻参考', description: '重点复刻目标图的构图、氛围与视觉表达', icon: '🎴' },
  mobile: { label: '手机比例', description: '适配移动端详情页与竖屏内容发布', icon: '🤳' },
};

const STEPS: Array<{ id: HDStep; label: string }> = [
  { id: 'input', label: '1. 输入' },
  { id: 'analyzing', label: '2. AI分析' },
  { id: 'color', label: '3. 方案确认' },
  { id: 'upscaling', label: '4. 光影融合' },
  { id: 'complete', label: '5. 完成' },
];

const MODEL_OPTIONS = [
  { id: 'gemini-3.1-flash-image-preview', label: 'Banana 2', desc: '3.1 Flash' },
  { id: 'gemini-3-pro-image-preview', label: 'Banana Pro', desc: '3 Pro' },
  { id: 'gpt-image-2', label: 'GPT Image 2', desc: 'Ultra Quality' },
  { id: 'qwen-image-3.0-pro', label: '千问3.0pro', desc: 'Qwen Image' },
];

const getCardAspectRatioClass = (ratio: AspectRatio) => {
  switch (ratio) {
    case AspectRatio.SQUARE:
      return 'aspect-square';
    case AspectRatio.PORTRAIT_2_3:
      return 'aspect-[2/3]';
    case AspectRatio.PORTRAIT_3_4:
      return 'aspect-[3/4]';
    case AspectRatio.PORTRAIT_9_16:
      return 'aspect-[9/16]';
    case AspectRatio.LANDSCAPE_16_9:
      return 'aspect-[16/9]';
    case AspectRatio.LANDSCAPE_21_9:
      return 'aspect-[21/9]';
    default:
      return 'aspect-[2/3]';
  }
};

const DATA_URL_PATTERN = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/;
const getDataUrl = (image: UploadedImage) => `data:${image.mime};base64,${image.base64}`;
const toApiImage = (image: UploadedImage) => ({ base64: image.base64, mimeType: image.mime });
const dataUrlToApiImage = (dataUrl: string) => {
  const match = dataUrl.match(DATA_URL_PATTERN);
  return { base64: match ? match[2] : dataUrl, mimeType: match ? match[1] : 'image/jpeg' };
};

const blobToDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onloadend = () => typeof reader.result === 'string'
    ? resolve(reader.result)
    : reject(new Error('生成图片转换失败'));
  reader.onerror = () => reject(reader.error || new Error('生成图片读取失败'));
  reader.readAsDataURL(blob);
});

const makeGeneratedImageCanvasSafe = async (source: string): Promise<string> => {
  if (!/^https?:\/\//i.test(source)) return source;
  return blobToDataUrl(await fetchImageBlob(source));
};

const buildTransferDirection = (record: ModelTransferRecord) => {
  const board = SCENE_BOARD_CONFIGS[record.boardType];
  const crop = cropFramingById(record.cropFraming);
  return [
    `Output scene module: ${board.label}. ${board.description}`,
    `Model actual height: ${record.modelHeight.trim() || 'Not specified; infer natural proportions from the references.'}`,
    `Outfit rule: ${record.clothingImages.length ? 'Use the uploaded clothing reference exactly.' : record.whiteBaseOutfit ? 'Plain white T-shirt, plain white shorts, barefoot.' : 'Preserve the target-scene outfit.'}`,
    crop.promptRule === 'AUTO_DETECT' ? 'Camera framing: infer the most suitable framing from the target scene.' : crop.promptRule,
    `Additional scene and transfer requirements: ${record.extraNotes.trim() || 'No additional requirements.'}`,
  ].join('\n');
};

const getOutfitSource = (record: ModelTransferRecord): 'clothing-reference' | 'white-basics' | 'target-scene' => {
  if (record.clothingImages.length) return 'clothing-reference';
  return record.whiteBaseOutfit ? 'white-basics' : 'target-scene';
};

const getOutfitRuleLabel = (record: ModelTransferRecord) => {
  if (record.clothingImages.length) return '优先使用服装参考图';
  return record.whiteBaseOutfit ? '白T恤 · 白短裤 · 赤脚' : '保留目标场景服装';
};

const fallbackAnalysis = (_notes: string): AgentAnalysis => ({
  identityBrief: 'Lock the exact source model identity: facial geometry, eyes, eyebrows, nose, lips, cheekbones, jawline, skin tone, age, hairline, hairstyle, hair color, hair length, hair texture, and body frame.',
  lightingBrief: 'Extract key-light direction, ambient contrast, color temperature, and contact shadows from target scene.',
  gazeAndPoseAnalysis: '已精准检测目标场景模特的头部偏转角 (如 3/4 侧脸/侧向视线)，指令将严格复制侧向视线与神情，防止生成僵硬正脸。',
  transferSourceOutfit: false,
  outfitReason: '服装由服装参考图、白色基础服装开关和目标场景服装按固定优先级决定。',
  lightingQuality: 'perfect',
  lightingAnalysis: '目标场景光影方向清晰，与源模特感光基调良好匹配，适合直接合成生成。',
  faceQuality: 'excellent',
  faceRecommendation: '当前上传的模特参考图清晰度良好，五官轮廓完整，推荐直接生成。',
  isReadyToGenerate: true,
  generatedPrompt: 'High quality commercial fashion photo, replace face with source model, match lighting and color tone.',
});

const buildAgentPrompt = (sourceCount: number, hasClothingReference: boolean, notes: string) => `
You are a fashion model transfer director, head pose specialist, and computer vision lighting analyst.
Analyze source model images 1-${sourceCount} for recognizable facial geometry, hairline, hairstyle, hair color, hair length, hair texture, age, skin tone, body frame, resolution, angle, and clarity. Treat multiple portraits or panels as views of the same person, never as different identities.
${hasClothingReference ? `Image ${sourceCount + 1} is a CLOTHING REFERENCE. Analyze its garment silhouette, fabric, color, construction, and styling details.` : 'No separate clothing reference was supplied.'}
Analyze target scene images for:
1. TARGET HEAD ROTATION & GAZE DIRECTION: (e.g. 3/4 side profile, looking off-camera to the left/right, head tilt, candid gaze, SERIOUS/SMILE expression).
2. LIGHT SOURCE DIRECTION, softness, and color temperature.
The outfit source is deterministic and must not be inferred from the source model. User instructions: "${notes || 'No extra notes'}".

Return valid JSON ONLY (no markdown formatting, no backticks):
{
  "identityBrief": "concise English identity lock covering exact face, hairline, hairstyle, hair color/length/texture, age, skin tone and body frame",
  "lightingBrief": "concise English scene lighting integration notes",
  "gazeAndPoseAnalysis": "Chinese analysis of target head angle, gaze direction, and expression (e.g. 目标场景模特为 3/4 侧脸且视线看向镜头外侧，已锁定侧脸视角与自然神情，禁止生成正脸看镜头...)",
  "transferSourceOutfit": false,
  "outfitReason": "short Chinese explanation of outfit decision",
  "lightingQuality": "perfect",
  "lightingAnalysis": "Chinese explanation of scene lighting and shadow compatibility",
  "faceQuality": "excellent",
  "faceRecommendation": "Chinese recommendation on model face quality",
  "isReadyToGenerate": true,
  "generatedPrompt": "Complete English Master Prompt for AI image generation"
}
`.trim();

const parseAgentAnalysis = (text: string, notes: string, fallbackPrompt: string): AgentAnalysis => {
  try {
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return fallbackAnalysis(notes);
    const parsed = JSON.parse(jsonMatch[0]);
    const fallback = fallbackAnalysis(notes);

    return {
      identityBrief: typeof parsed.identityBrief === 'string' && parsed.identityBrief.trim()
        ? parsed.identityBrief.trim()
        : fallback.identityBrief,
      lightingBrief: typeof parsed.lightingBrief === 'string' && parsed.lightingBrief.trim()
        ? parsed.lightingBrief.trim()
        : fallback.lightingBrief,
      gazeAndPoseAnalysis: typeof parsed.gazeAndPoseAnalysis === 'string' && parsed.gazeAndPoseAnalysis.trim()
        ? parsed.gazeAndPoseAnalysis.trim()
        : fallback.gazeAndPoseAnalysis,
      transferSourceOutfit: Boolean(parsed.transferSourceOutfit),
      outfitReason: typeof parsed.outfitReason === 'string' && parsed.outfitReason.trim()
        ? parsed.outfitReason.trim()
        : fallback.outfitReason,
      lightingQuality: parsed.lightingQuality === 'warning' ? 'warning' : parsed.lightingQuality === 'good' ? 'good' : 'perfect',
      lightingAnalysis: typeof parsed.lightingAnalysis === 'string' && parsed.lightingAnalysis.trim()
        ? parsed.lightingAnalysis.trim()
        : fallback.lightingAnalysis,
      faceQuality: parsed.faceQuality === 'need_better_photo' ? 'need_better_photo' : parsed.faceQuality === 'adequate' ? 'adequate' : 'excellent',
      faceRecommendation: typeof parsed.faceRecommendation === 'string' && parsed.faceRecommendation.trim()
        ? parsed.faceRecommendation.trim()
        : fallback.faceRecommendation,
      isReadyToGenerate: parsed.isReadyToGenerate !== false,
      generatedPrompt: typeof parsed.generatedPrompt === 'string' && parsed.generatedPrompt.trim()
        ? parsed.generatedPrompt.trim()
        : fallbackPrompt,
    };
  } catch {
    return fallbackAnalysis(notes);
  }
};

const buildTransferPrompt = (options: {
  analysis: AgentAnalysis;
  outfitSource: 'clothing-reference' | 'white-basics' | 'target-scene';
  extraNotes: string;
  sceneNumber: number;
}) => {
  const hasClothingReference = options.outfitSource === 'clothing-reference';
  const outfitRules = options.outfitSource === 'clothing-reference'
    ? `# FIGURE 3 — MANDATORY CLOTHING AND SHOES REFERENCE\n- Replace the clothing and shoes in Figure 2 with the dress/outfit and shoes from Figure 3.\n- Preserve Figure 3's exact garment category, silhouette, cut, fabric texture, color, pattern, seams, closures, trims, logos, footwear, and styling details.\n- Fit them naturally to Figure 2's unchanged pose. Figure 3 has ZERO authority over identity, face, hair, body shape, pose, camera, background, composition, or lighting.`
    : options.outfitSource === 'white-basics'
      ? `# MANDATORY WHITE BASIC OUTFIT — LOCAL WARDROBE EDIT ONLY\n- Replace only the clothing and footwear region in Figure 2 with a plain solid-white short-sleeve T-shirt and plain solid-white shorts.\n- The person MUST be barefoot: no shoes, socks, sandals, slippers, boots, or other footwear.\n- This wardrobe instruction does NOT authorize a new scene, new pose, studio background, catalog restaging, zoom, crop, or camera change.`
      : `# MANDATORY FIGURE 2 WARDROBE LOCK\n- Preserve the exact clothing and shoes already worn in Figure 2, including category, silhouette, cut, fabric, colors, patterns, seams, accessories, and styling.\n- Do not copy clothing or shoes from any identity reference.`;

  return `
# IDENTITY-FIRST MODEL TRANSFER — FIGURE 1 HAS HIGHEST IDENTITY WEIGHT

# FIGURE MAPPING — NEVER REORDER OR MIX ROLES
- Figure 1: PRIMARY SOURCE MODEL and highest-priority identity reference. It controls recognizable face, facial geometry, hairline, hairstyle, hair color, hair length, hair texture, skin tone, age impression, and body frame. If it is a multi-view portrait sheet, all panels show the same person.
- Figure 2: TARGET SCENE and composition base. It controls background, objects, framing, camera, subject placement, pose, head angle, gaze, expression, lighting, shadows, and photographic style, but NOT the person's identity or hairstyle.
${hasClothingReference ? '- Figure 3: CLOTHING AND SHOES reference. Use it only for the requested outfit and footwear.\n- Figure 4+: supplementary source-model identity and detail references only.' : '- Figure 3+: supplementary source-model identity and detail references only.'}

# SOURCE MODEL IDENTITY LOCK — HIGHEST PRIORITY
- ${options.analysis.identityBrief}
- The output person must be immediately recognizable as Figure 1, not as the original person in Figure 2 and not as a blended or averaged identity.
- Transfer Figure 1's hairstyle together with the identity: exact hairline, parting, silhouette, length, color, texture, volume, and characteristic strands. Adapt it naturally to Figure 2's head angle and gravity; do not preserve or blend Figure 2's hairstyle.
- Ignore Figure 1's background, clothing, pose, camera, crop, studio layout, and lighting. These have zero authority over the target composition.

# ABSOLUTE FIGURE 2 SCENE AND POSE LOCK
- This is an in-place image edit, NOT a new photo generation, restaging, or scene recreation.
- Keep Figure 2's background/location pixel-consistent: architecture, walls, floor, furniture, props, vegetation, sky, horizon, shadows, reflections, texture, and every non-person object must remain in the same position and appearance.
- Keep Figure 2's exact canvas, framing, crop, camera angle, lens perspective, camera distance, subject scale and placement, pose, joint coordinates, hands, legs, expression, gaze direction, and head angle.
- Keep Figure 2's original lighting direction, exposure, color temperature, contrast, shadow geometry, contact shadows, depth of field, grain, and photographic style.
- Never replace Figure 2's location with a white/gray studio, seamless backdrop, catalog background, similar-looking scene, or newly invented environment.
- When any instruction conflicts with preserving Figure 2's scene, composition, pose, or camera, preserve Figure 2. Identity and hairstyle still come from Figure 1.

${outfitRules}

# PERSON REPLACEMENT AND GEOMETRY ADAPTATION
- Replace Figure 2's original person identity with Figure 1's exact identity and hairstyle while preserving Figure 2's pose, joint coordinates, head rotation, expression, gaze, perspective, scale, focus, and occlusion.
- Preserve Figure 1's natural facial asymmetry, eye spacing, eyebrow shape, nose structure, lip shape, cheekbones, jawline, ears, hairline, age and skin tone. Do not beautify into a generic model.
- Preserve Figure 1's body frame and proportions wherever visible and compatible with Figure 2's fixed pose and framing.
- Do not copy Figure 1's pose, clothing, background, studio lighting, camera, crop, or composition.

# NATURAL COMPOSITING
- ${options.analysis.lightingBrief}
- Target pose analysis: ${options.analysis.gazeAndPoseAnalysis || 'Match Figure 2 head angle, gaze and expression exactly.'}
- Match the transferred person to Figure 2's key light, fill, highlight softness, skin illumination, cast shadows, contact shadows, perspective, focus, grain, and color response.
- Render one coherent photographed person with continuous hair roots, forehead, ears, jaw, neck and shoulders. Preserve pores, fine skin texture, natural asymmetry, flyaway hairs and camera grain; avoid waxy skin, beauty-filter smoothing, CGI, doll-like features, pasted-face seams or floating hair.
- The result must look like the exact person from Figure 1 was genuinely photographed in Figure 2's scene and pose.

# USER NOTES
${options.extraNotes || 'No extra notes.'}

# FAILURE REJECTION
different identity, generic face, blended identity, original Figure 2 identity retained, source hairstyle lost, Figure 2 hairstyle retained, changed hair color or length, waxy or plastic skin, beauty-filter face, CGI person, pasted face, floating hair, mismatched neck, distorted facial geometry, different background, white studio, gray studio, seamless backdrop, changed scene, recreated scene, changed camera, changed crop, changed subject placement, changed pose, changed props, missing objects, added objects, source-reference background leakage, catalog restaging, duplicate person, collage, split screen.
`.trim();
};

const createRecord = (): ModelTransferRecord => ({
  id: crypto.randomUUID(),
  createdAt: Date.now(),
  step: 'input',
  checkpoint: 'input',
  oneClick: false,
  sourceModels: [],
  clothingImages: [],
  targetScenes: [],
  selectedModel: MODEL_OPTIONS[0].id,
  aspectRatio: AspectRatio.PORTRAIT_2_3,
  resolution: ImageResolution.RES_2K,
  outputFormat: 'png',
  colorCorrectionMode: 'match',
  colorCorrectionBlend: 0.55,
  whiteBaseOutfit: false,
  boardType: 'social',
  cropFraming: 'full-length',
  modelHeight: '',
  outputCount: 1,
  extraNotes: '',
  agentAnalysis: null,
  results: [],
  error: null,
});

const WorkflowSteps: React.FC<{ step: HDStep }> = ({ step }) => {
  const stepOrder: HDStep[] = ['input', 'analyzing', 'color', 'upscaling', 'complete'];
  const current = stepOrder.indexOf(step);

  return (
    <div className="no-scrollbar mt-4 flex items-center justify-start gap-2 overflow-x-auto pb-1 sm:justify-center">
      {STEPS.map((item, index) => (
        <React.Fragment key={item.id}>
          <div className={`flex min-w-fit items-center gap-2 text-xs font-black ${index <= current ? 'text-[#17243c] dark:text-white' : 'text-[#93a2b6]'}`}>
            <span className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs ${index < current ? 'border-[#ed6d46] bg-[#ed6d46] text-white' : index === current ? 'border-[#17243c] bg-[#17243c] text-white' : 'border-[#d8e2ec] bg-white text-[#93a2b6] dark:bg-white/5'}`}>
              {index < current ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span>{item.label}</span>
          </div>
          {index < STEPS.length - 1 && <span className="h-px w-6 shrink-0 bg-[#d8e2ec] sm:w-10" />}
        </React.Fragment>
      ))}
    </div>
  );
};

const SelectionModal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-[#10203a]/60 p-3 backdrop-blur-sm" onMouseDown={onClose}>
      <section className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[1.5rem] border border-white/60 bg-white shadow-2xl dark:border-white/10 dark:bg-[#15191f]" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex min-h-16 items-center justify-between border-b border-pastel-border px-5 sm:px-6">
          <h2 className="text-base font-black">{title}</h2>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl bg-pastel-bg text-pastel-muted" aria-label="关闭"><X className="h-5 w-5" /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
      </section>
    </div>
  );
};

// ==================== Main Component ====================

const ModelTransferTab: React.FC<{ isActive?: boolean }> = ({ isActive = true }) => {
  const initialRecordRef = useRef<ModelTransferRecord | null>(null);
  if (!initialRecordRef.current) initialRecordRef.current = createRecord();

  const [records, setRecords] = useState<ModelTransferRecord[]>([initialRecordRef.current]);
  const [activeRecordId, setActiveRecordId] = useState<string>(initialRecordRef.current.id);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [activeUploadKind, setActiveUploadKind] = useState<UploadKind>('model');
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const [imageCrop, setImageCrop] = useState<{ recordId: string; kind: UploadKind; imageId: string; url: string; file: File } | null>(null);
  const [selectionModal, setSelectionModal] = useState<'ratio' | 'board' | 'crop' | null>(null);
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [isPromptCopied, setIsPromptCopied] = useState(false);

  const activeUploadKindRef = useRef<UploadKind>('model');
  const modelInputRef = useRef<HTMLInputElement>(null);
  const clothingInputRef = useRef<HTMLInputElement>(null);
  const sceneInputRef = useRef<HTMLInputElement>(null);
  const generationControllersRef = useRef(new Map<string, { taskId: number; controller: AbortController }>());
  const generationSequenceRef = useRef(0);

  const activeRecord = useMemo(
    () => records.find((r) => r.id === activeRecordId) || records[0],
    [records, activeRecordId]
  );

  const patchActive = useCallback(
    (patch: Partial<ModelTransferRecord>) => {
      setRecords((prev) =>
        prev.map((rec) => (rec.id === activeRecordId ? { ...rec, ...patch } : rec))
      );
    },
    [activeRecordId]
  );

  const patchRecord = useCallback((recordId: string, patch: Partial<ModelTransferRecord>) => {
    setRecords((prev) => prev.map((rec) => (rec.id === recordId ? { ...rec, ...patch } : rec)));
  }, []);

  const isGenerating = Boolean(activeRecord.isGenerating);
  const statusMessage = activeRecord.statusMessage || '';
  const canGenerate = activeRecord.sourceModels.length > 0 && activeRecord.targetScenes.length > 0 && !isGenerating;
  const completedCount = activeRecord.results.filter((item) => item.status === 'done' || item.status === 'error' || item.status === 'cancelled').length;

  const startGenerationTask = (recordId: string) => {
    const previous = generationControllersRef.current.get(recordId);
    previous?.controller.abort();
    const controller = new AbortController();
    const taskId = ++generationSequenceRef.current;
    generationControllersRef.current.set(recordId, { taskId, controller });
    return { taskId, signal: controller.signal };
  };

  const isCurrentGenerationTask = (recordId: string, taskId: number) => {
    const task = generationControllersRef.current.get(recordId);
    return Boolean(task && task.taskId === taskId && !task.controller.signal.aborted);
  };

  const assertCurrentGenerationTask = (recordId: string, taskId: number, signal?: AbortSignal) => {
    if (signal?.aborted || !isCurrentGenerationTask(recordId, taskId)) throw new DOMException('Generation cancelled', 'AbortError');
  };

  const finishGenerationTask = (recordId: string, taskId: number) => {
    if (generationControllersRef.current.get(recordId)?.taskId === taskId) {
      generationControllersRef.current.delete(recordId);
      patchRecord(recordId, { isGenerating: false });
    }
  };

  const startNewRecord = () => {
    const runningTask = generationControllersRef.current.get(activeRecord.id);
    runningTask?.controller.abort();
    generationControllersRef.current.delete(activeRecord.id);

    // "Restart" keeps the user's expensive input setup and only resets the
    // workflow/results. A new history record is still created so the previous
    // generated batch remains available in the left panel.
    const fresh: ModelTransferRecord = {
      ...createRecord(),
      oneClick: activeRecord.oneClick,
      sourceModels: activeRecord.sourceModels.map((image) => ({ ...image })),
      clothingImages: activeRecord.clothingImages.map((image) => ({ ...image })),
      targetScenes: activeRecord.targetScenes.map((image) => ({ ...image })),
      selectedModel: activeRecord.selectedModel,
      aspectRatio: activeRecord.aspectRatio,
      resolution: activeRecord.resolution,
      outputFormat: activeRecord.outputFormat,
      colorCorrectionMode: activeRecord.colorCorrectionMode,
      colorCorrectionBlend: activeRecord.colorCorrectionBlend,
      whiteBaseOutfit: activeRecord.whiteBaseOutfit,
      boardType: activeRecord.boardType,
      cropFraming: activeRecord.cropFraming,
      modelHeight: activeRecord.modelHeight,
      outputCount: activeRecord.outputCount,
      extraNotes: activeRecord.extraNotes,
      statusMessage: activeRecord.sourceModels.length || activeRecord.targetScenes.length
        ? '已保留全部参考图和生成参数，可以重新开始迁移。'
        : '',
    };
    setRecords((prev) => [fresh, ...prev.slice(0, MAX_RECORDS - 1)]);
    setActiveRecordId(fresh.id);
  };

  const deleteRecord = (id: string) => {
    if (records.length <= 1) {
      const fresh = createRecord();
      setRecords([fresh]);
      setActiveRecordId(fresh.id);
      return;
    }
    const nextRecords = records.filter((r) => r.id !== id);
    setRecords(nextRecords);
    if (activeRecordId === id) {
      setActiveRecordId(nextRecords[0].id);
    }
  };

  const processFiles = useCallback(async (files: File[], kind: UploadKind) => {
    const valid = files.filter((file) => file.type.startsWith('image/'));
    const currentCount = kind === 'model'
      ? activeRecord.sourceModels.length
      : kind === 'clothing'
        ? activeRecord.clothingImages.length
        : activeRecord.targetScenes.length;
    const max = kind === 'model' ? MAX_MODEL_IMAGES : kind === 'clothing' ? MAX_CLOTHING_IMAGES : MAX_SCENE_IMAGES;
    const accepted = valid.slice(0, Math.max(0, max - currentCount));
    if (!accepted.length) {
      if (valid.length) patchActive({ error: `${kind === 'model' ? '模特参考图' : kind === 'clothing' ? '服装参考图' : '目标场景图'}最多上传 ${max} 张。` });
      return;
    }
    try {
      const uploaded = await Promise.all(accepted.map(async (file): Promise<UploadedImage> => {
        const compressed = await compressImage(file, 1800, 0.92);
        return {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          preview: URL.createObjectURL(file),
          base64: compressed.base64,
          mime: compressed.mime,
          name: file.name,
        };
      }));

      if (kind === 'model') {
        patchActive({ sourceModels: [...activeRecord.sourceModels, ...uploaded].slice(0, MAX_MODEL_IMAGES), checkpoint: 'input', step: 'input', agentAnalysis: null, results: [] });
      } else if (kind === 'clothing') {
        patchActive({ clothingImages: uploaded.slice(0, MAX_CLOTHING_IMAGES), checkpoint: 'input', step: 'input', agentAnalysis: null, results: [] });
      } else {
        patchActive({ targetScenes: [...activeRecord.targetScenes, ...uploaded].slice(0, MAX_SCENE_IMAGES), checkpoint: 'input', step: 'input', agentAnalysis: null, results: [] });
      }

      patchActive({ error: null });
    } catch (err: any) {
      patchActive({ error: getErrorMessage(err) });
    }
  }, [activeRecord, patchActive]);

  const activateUploadKind = useCallback((kind: UploadKind) => {
    activeUploadKindRef.current = kind;
    setActiveUploadKind(kind);
  }, []);

  const handlePastedImages = useCallback((files: File[]) => {
    void processFiles(files, activeUploadKindRef.current);
  }, [processFiles]);
  useImagePaste(handlePastedImages, isActive && !isGenerating);

  const removeUploadedImage = (kind: UploadKind, id: string) => {
    if (kind === 'model') {
      patchActive({ sourceModels: activeRecord.sourceModels.filter((m) => m.id !== id), checkpoint: 'input', step: 'input', agentAnalysis: null, results: [] });
    } else if (kind === 'clothing') {
      patchActive({ clothingImages: activeRecord.clothingImages.filter((image) => image.id !== id), checkpoint: 'input', step: 'input', agentAnalysis: null, results: [] });
    } else {
      patchActive({ targetScenes: activeRecord.targetScenes.filter((s) => s.id !== id), checkpoint: 'input', step: 'input', agentAnalysis: null, results: [] });
    }
  };

  const openImageCrop = (kind: UploadKind, image: UploadedImage) => {
    if (isGenerating) return;
    setImageCrop({
      recordId: activeRecord.id,
      kind,
      imageId: image.id,
      url: image.preview || getDataUrl(image),
      file: new File([], image.name || 'image.png'),
    });
  };

  const applyImageCrop = async (newFile: File, newUrl: string) => {
    const target = imageCrop;
    if (!target) {
      URL.revokeObjectURL(newUrl);
      return;
    }

    try {
      const compressed = await compressImage(newFile, 1800, 0.92);
      setRecords((current) => current.map((record) => {
        if (record.id !== target.recordId) return record;
        const updateImage = (image: UploadedImage): UploadedImage => image.id === target.imageId
          ? { ...image, preview: newUrl, base64: compressed.base64, mime: compressed.mime, name: newFile.name }
          : image;
        return {
          ...record,
          sourceModels: target.kind === 'model' ? record.sourceModels.map(updateImage) : record.sourceModels,
          clothingImages: target.kind === 'clothing' ? record.clothingImages.map(updateImage) : record.clothingImages,
          targetScenes: target.kind === 'scene' ? record.targetScenes.map(updateImage) : record.targetScenes,
          checkpoint: 'input',
          step: 'input',
          agentAnalysis: null,
          results: [],
          error: null,
          statusMessage: '',
        };
      }));
    } catch (error) {
      patchRecord(target.recordId, { error: `图片裁切保存失败：${getErrorMessage(error)}` });
      throw error;
    }
  };

  // ==================== Agent Step-by-Step Handlers ====================

  const runStep1_Analyze = async () => {
    if (!activeRecord.sourceModels.length || !activeRecord.targetScenes.length || isGenerating) return;

    const recordId = activeRecord.id;
    const record = activeRecord;
    const { taskId, signal } = startGenerationTask(recordId);
    patchRecord(recordId, { error: null, agentAnalysis: null, step: 'analyzing', isGenerating: true, statusMessage: 'Agent 正在深度解析源模特基因与目标场景光影...' });

    try {
      assertCurrentGenerationTask(recordId, taskId, signal);
      const text = await generateText(
        [...record.sourceModels.map(toApiImage), ...record.clothingImages.map(toApiImage), ...record.targetScenes.map(toApiImage)],
        buildAgentPrompt(record.sourceModels.length, record.clothingImages.length > 0, buildTransferDirection(record))
      );
      assertCurrentGenerationTask(recordId, taskId, signal);

      const defaultTransferPrompt = buildTransferPrompt({
        analysis: fallbackAnalysis(record.extraNotes),
        outfitSource: getOutfitSource(record),
        extraNotes: buildTransferDirection(record),
        sceneNumber: 1,
      });

      const analysis = parseAgentAnalysis(text, activeRecord.extraNotes, defaultTransferPrompt);

      patchRecord(recordId, {
        agentAnalysis: analysis,
        checkpoint: 'analyzed',
        step: 'analyzing',
      });
      patchRecord(recordId, { statusMessage: 'Agent 分析完成，请确认人物身份与光影融合方案。' });

      if (record.oneClick) {
        finishGenerationTask(recordId, taskId);
        await runStep2_ConfirmPlan(recordId, analysis);
        return;
      }
    } catch (err: any) {
      if (!isAbortError(err)) patchRecord(recordId, { error: getErrorMessage(err), step: 'input' });
    } finally {
      if (isCurrentGenerationTask(recordId, taskId)) {
        finishGenerationTask(recordId, taskId);
      }
    }
  };

  const runStep2_ConfirmPlan = async (recordId = activeRecord.id, analysis = activeRecord.agentAnalysis || fallbackAnalysis(activeRecord.extraNotes)) => {
    patchRecord(recordId, { checkpoint: 'confirmed', step: 'color', statusMessage: '人物身份与目标场景融合方案已确认。' });

    const record = records.find((item) => item.id === recordId);
    if (record?.oneClick) {
      await runStep3_FinalTransfer(recordId, analysis);
    }
  };

  const runStep3_FinalTransfer = async (recordId = activeRecord.id, analysis = activeRecord.agentAnalysis || fallbackAnalysis(activeRecord.extraNotes)) => {
    const record = records.find((item) => item.id === recordId);
    if (!record) return;
    const sources = [...record.sourceModels];
    const scenes = [...record.targetScenes];
    const totalOutputCount = scenes.length * record.outputCount;
    const { taskId, signal } = startGenerationTask(recordId);

    patchRecord(recordId, { error: null, step: 'upscaling', isGenerating: true, statusMessage: '正在提取模特身份锚点并匹配目标场景光影...' });
    patchRecord(recordId, {
      results: scenes.flatMap((scene) => Array.from({ length: record.outputCount }, (_, variantIndex) => ({
        id: `transfer-${scene.id}-${variantIndex + 1}`,
        sceneId: scene.id,
        sceneName: record.outputCount > 1 ? `${scene.name} · 变体 ${variantIndex + 1}` : scene.name,
        imageUrl: null,
        status: 'pending' as GenerationStatus,
        prompt: '',
      }))),
    });

    try {
      assertCurrentGenerationTask(recordId, taskId, signal);

      const [identityAnchors, preparedScenes] = await Promise.all([
        prepareIdentityAnchors(sources),
        prepareScenes(scenes),
      ]);
      assertCurrentGenerationTask(recordId, taskId, signal);

      const generationJobs = preparedScenes.flatMap((prepared, sceneIndex) =>
        Array.from({ length: record.outputCount }, (_, variantIndex) => ({
          prepared,
          sceneIndex,
          variantIndex,
          resultId: `transfer-${prepared.scene.id}-${variantIndex + 1}`,
        }))
      );

      patchRecord(recordId, { statusMessage: `已提交 ${totalOutputCount} 张精准人物迁移与光影重建任务...` });

      const settled = await Promise.allSettled(
        generationJobs.map(({ prepared, sceneIndex, variantIndex, resultId }) =>
          generatePreparedScene({ record, recordId, prepared, sceneIndex, variantIndex, resultId, sources, identityAnchors, analysis, signal })
            .then((item) => {
              if (isCurrentGenerationTask(recordId, taskId)) updateResult(recordId, resultId, item);
              return item;
            })
            .catch((itemError) => {
              if (isAbortError(itemError)) {
                if (isCurrentGenerationTask(recordId, taskId)) updateResult(recordId, resultId, { status: 'cancelled', error: '已中止' });
                throw itemError;
              }
              const failed: ResultItem = {
                id: resultId,
                sceneId: prepared.scene.id,
                sceneName: record.outputCount > 1 ? `${prepared.scene.name} · 变体 ${variantIndex + 1}` : prepared.scene.name,
                imageUrl: null,
                status: 'error',
                prompt: '',
                error: getErrorMessage(itemError),
              };
              if (isCurrentGenerationTask(recordId, taskId)) updateResult(recordId, resultId, failed);
              return failed;
            })
        )
      );

      assertCurrentGenerationTask(recordId, taskId, signal);
      const batchResults = settled
        .filter((entry): entry is PromiseFulfilledResult<ResultItem> => entry.status === 'fulfilled')
        .map((entry) => entry.value);

      await saveBatch(record, sources, scenes, analysis, batchResults);
      patchRecord(recordId, { checkpoint: 'complete', step: 'complete', statusMessage: `批量迁移完成：${batchResults.filter((item) => item.status === 'done').length}/${totalOutputCount} 张成功` });
    } catch (generateError) {
      if (!isAbortError(generateError)) patchActive({ error: getErrorMessage(generateError) });
    } finally {
      if (!isCurrentGenerationTask(recordId, taskId)) return;
      finishGenerationTask(recordId, taskId);
    }
  };

  const prepareIdentityAnchors = async (sources: UploadedImage[]) => {
    const anchors = await Promise.all(sources.map(async (source) => {
      const fullReference = getDataUrl(source);
      const croppedReference = await createModelHeadIdentityCrop(fullReference);
      return croppedReference === fullReference ? null : dataUrlToApiImage(croppedReference);
    }));
    return anchors.filter((anchor): anchor is { base64: string; mimeType: string } => Boolean(anchor));
  };

  const prepareScenes = (scenes: UploadedImage[]): Promise<PreparedScene[]> =>
    Promise.resolve(scenes.map((scene) => ({ scene })));

  const updateResult = (recordId: string, resultId: string, patch: Partial<ResultItem>) => {
    setRecords((prev) =>
      prev.map((rec) => {
        if (rec.id !== recordId) return rec;
        const exists = rec.results.some((item) => item.id === resultId);
        const updatedResults: ResultItem[] = exists
          ? rec.results.map((item) => (item.id === resultId ? { ...item, ...patch, id: resultId } : item))
          : [...rec.results, { id: resultId, sceneId: patch.sceneId || '', sceneName: patch.sceneName || '', imageUrl: null, status: 'pending' as GenerationStatus, prompt: '', ...patch }];
        return {
          ...rec,
          results: updatedResults,
        };
      })
    );
  };

  const generatePreparedScene = async (options: {
    record: ModelTransferRecord;
    recordId: string;
    prepared: PreparedScene;
    sceneIndex: number;
    variantIndex: number;
    resultId: string;
    sources: UploadedImage[];
    identityAnchors: Array<{ base64: string; mimeType: string }>;
    analysis: AgentAnalysis;
    signal: AbortSignal;
  }): Promise<ResultItem> => {
    const { record, recordId, prepared, sceneIndex, variantIndex, resultId, sources, identityAnchors, analysis, signal } = options;
    const prompt = buildTransferPrompt({
      analysis,
      outfitSource: getOutfitSource(record),
      extraNotes: `${buildTransferDirection(record)}\nGenerate variation ${variantIndex + 1} of ${record.outputCount}; preserve identity and target-scene structure while allowing subtle natural variation.`,
      sceneNumber: sceneIndex + 1,
    });
    updateResult(recordId, resultId, { status: 'submitting', error: undefined, prompt });

    // Put the user's primary model reference first: several image models give
    // earlier references more influence. The target scene remains the geometry
    // and composition base through the explicit Figure 2 prompt contract.
    const inputImages = [toApiImage(sources[0]), toApiImage(prepared.scene)];
    inputImages.push(...record.clothingImages.map(toApiImage));
    inputImages.push(...sources.slice(1).map(toApiImage));
    inputImages.push(...identityAnchors);

    const [rawImage] = await generateImageToImage(
      inputImages,
      prompt,
      {
        aspectRatio: record.aspectRatio,
        resolution: record.resolution,
        modelId: record.selectedModel,
        workflowHint: 'model-transfer',
        hasModelRef: true,
        signal,
        onStatus: (status) => updateResult(recordId, resultId, { status }),
      }
    );

    if (!rawImage) throw new Error('模型未返回图片。');
    updateResult(recordId, resultId, { status: 'processing' });
    let formattedImage = rawImage;
    try {
      // Virse commonly returns Google Storage URLs without browser CORS headers.
      // Fetch them through our same-origin proxy before using Canvas so color
      // correction cannot taint/fail the generated result.
      const canvasSafeImage = record.colorCorrectionMode === 'off'
        ? rawImage
        : await makeGeneratedImageCanvasSafe(rawImage);
      const correctedImage = await applyColorCorrection(canvasSafeImage, {
        mode: record.colorCorrectionMode,
        reference: record.colorCorrectionMode === 'match' ? getDataUrl(prepared.scene) : undefined,
        blend: record.colorCorrectionBlend,
      });
      formattedImage = await convertImageDataUrlFormat(correctedImage, record.outputFormat);
    } catch (postProcessError) {
      // The upstream generation succeeded. Keep the original result available
      // even if proxying, Canvas processing, or format conversion fails.
      console.warn('Model transfer post-processing failed. Using the original generated image.', postProcessError);
    }
    const finalResult: ResultItem = {
      id: resultId,
      sceneId: prepared.scene.id,
      sceneName: record.outputCount > 1 ? `${prepared.scene.name} · 变体 ${variantIndex + 1}` : prepared.scene.name,
      imageUrl: formattedImage,
      status: 'done',
      prompt,
    };
    updateResult(recordId, resultId, finalResult);
    return finalResult;
  };

  const saveBatch = async (record: ModelTransferRecord, sources: UploadedImage[], scenes: UploadedImage[], analysis: AgentAnalysis, batchResults: ResultItem[]) => {
    const successful = batchResults.filter((item) => item.status === 'done' && item.imageUrl);
    if (!successful.length) return;
    await saveGeneratedProject({
      type: 'MODEL',
      generated: successful.map((item) => item.imageUrl!),
      original: [...sources, ...record.clothingImages, ...scenes].map(getDataUrl),
      prompt: successful[0].prompt,
      params: {
        subType: 'model_transfer_batch',
        source: 'Cyzx4/components/ModelTransferTab',
        aspectRatio: record.aspectRatio,
        resolution: record.resolution,
        model: record.selectedModel,
        outputFormat: record.outputFormat,
        sourceModelCount: sources.length,
        targetSceneCount: scenes.length,
        outputCount: record.outputCount,
        boardType: record.boardType,
        cropFraming: record.cropFraming,
        modelHeight: record.modelHeight,
        outfitSource: getOutfitSource(record),
        whiteBaseOutfit: record.whiteBaseOutfit,
        clothingReferenceCount: record.clothingImages.length,
        colorCorrectionMode: record.colorCorrectionMode,
        colorCorrectionBlend: record.colorCorrectionBlend,
        extraNotes: record.extraNotes,
        identityBrief: analysis.identityBrief,
        sceneResultMap: batchResults.map((item) => ({ sceneId: item.sceneId, sceneName: item.sceneName, status: item.status, error: item.error })),
      },
      thumbnail: successful[0].imageUrl || undefined,
    });
  };

  const handleCancelGenerate = () => {
    const task = generationControllersRef.current.get(activeRecord.id);
    task?.controller.abort();
    patchRecord(activeRecord.id, {
      results: activeRecord.results.map((item) =>
        ['pending', 'submitting', 'polling', 'processing'].includes(item.status)
          ? { ...item, status: 'cancelled', error: '已中止' }
          : item
      ),
      isGenerating: false,
      statusMessage: '已中止模特迁移生成',
    });
  };

  const handleDownload = async (url: string, index: number) => {
    try {
      await downloadImageFile(url, `model-transfer-${index + 1}.${getImageDownloadExtension(url, activeRecord.outputFormat)}`);
    } catch (error) {
      console.error('Failed to download model transfer image.', error);
      window.alert('图片下载失败，请稍后重试');
    }
  };

  const handleDownloadAll = () => activeRecord.results.forEach((item, index) => {
    if (item.imageUrl) handleDownload(item.imageUrl, index);
  });

  const statusLabel = (status: GenerationStatus) => ({
    pending: '等待提交',
    submitting: '正在提交',
    polling: '异步轮询中',
    processing: '结果处理中',
    done: '已完成',
    error: '生成失败',
    cancelled: '已中止',
  })[status];

  const isWorkingStatus = (status: GenerationStatus) =>
    status === 'pending' || status === 'submitting' || status === 'polling' || status === 'processing';

  // History Panel Component — visually aligned with SceneGenerationTab.
  const historyPanel = (
    <aside className="flex h-full flex-col rounded-2xl border border-[#d8e3ee] bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#11151c]">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-base font-black">生成记录</h2>
          <p className="mt-0.5 text-xs text-pastel-muted">当前会话最多20项</p>
        </div>
        <button type="button" onClick={() => setIsHistoryOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-pastel-border text-pastel-muted" aria-label="收起生成记录"><PanelLeftClose className="h-4 w-4" /></button>
      </div>

      <button
        type="button"
        onClick={startNewRecord}
        disabled={isGenerating}
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#17243c] text-sm font-black text-white disabled:opacity-40"
      >
        <RotateCcw className="h-4 w-4" /> 重新开始（保留素材）
      </button>

      <div className="mt-3 flex-1 space-y-2 overflow-y-auto">
        {records.map((record) => (
          <button
            key={record.id}
            type="button"
            onClick={() => setActiveRecordId(record.id)}
            className={`group relative w-full overflow-hidden rounded-xl border p-3 text-left transition ${record.id === activeRecord.id ? 'border-[#ed6d46] bg-[#fff8f3]' : 'border-pastel-border bg-pastel-bg/40 hover:border-[#efb49d]'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="truncate text-xs font-black">{record.sourceModels[0]?.name || '未命名模特迁移'}</span>
              <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[0.62rem] font-bold text-pastel-muted">{STEPS.find((item) => item.id === record.step)?.label}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[0.68rem] text-pastel-muted">
              <span>模特 {record.sourceModels.length}张 · 场景 {record.targetScenes.length}张</span>
              <span>{new Date(record.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <span
              role="button"
              tabIndex={0}
              onClick={(event) => { event.stopPropagation(); deleteRecord(record.id); }}
              onKeyDown={(event) => { if (event.key === 'Enter') { event.stopPropagation(); deleteRecord(record.id); } }}
              className="absolute bottom-2 right-2 hidden h-8 w-8 items-center justify-center rounded-lg bg-white text-red-400 shadow group-hover:flex"
              aria-label="删除记录"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </span>
          </button>
        ))}
      </div>
    </aside>
  );

  const renderUploadArea = (kind: UploadKind) => {
    const isModel = kind === 'model';
    const isClothing = kind === 'clothing';
    const images = isModel ? activeRecord.sourceModels : isClothing ? activeRecord.clothingImages : activeRecord.targetScenes;
    const max = isModel ? MAX_MODEL_IMAGES : isClothing ? MAX_CLOTHING_IMAGES : MAX_SCENE_IMAGES;
    const inputRef = isModel ? modelInputRef : isClothing ? clothingInputRef : sceneInputRef;
    const title = isModel ? '我的模特参考图' : isClothing ? '服装参考图（可选）' : '目标场景图';
    const description = isModel
      ? '最多 3 张：第 1 张拥有最高身份权重，严格锁定脸型、五官、发际线、发型与发色；第 2、3 张用于补充侧面和微侧细节。'
      : isClothing
        ? '最多 1 张。上传后将优先使用这套服装；未上传时默认保留目标场景服装。'
        : '最多 10 张，作为人物迁移后的动作、构图与光影承载；上传后可裁切。';

    return (
      <section
        onMouseEnter={() => activateUploadKind(kind)}
        className={`rounded-2xl border bg-white p-4 shadow-sm sm:p-5 dark:bg-[#11151c] ${
          activeUploadKind === kind ? 'border-[#9fc5eb] ring-1 ring-[#9fc5eb]/45' : 'border-pastel-border'
        }`}
      >
        {kind === 'scene' && (
          <label className={`mb-4 flex items-center justify-between gap-3 rounded-xl border p-3 transition ${activeRecord.whiteBaseOutfit && !activeRecord.clothingImages.length ? 'border-orange-200 bg-[#fff8f3]' : 'border-pastel-border bg-pastel-bg/40'} ${activeRecord.clothingImages.length ? 'cursor-not-allowed opacity-65' : 'cursor-pointer'}`}>
            <span className="min-w-0">
              <strong className="block text-xs font-black text-[#17243c] dark:text-white">白色基础服装</strong>
              <small className="mt-1 block text-[0.68rem] leading-5 text-pastel-muted">
                {activeRecord.clothingImages.length ? '已上传服装参考图，服装图优先，当前开关不生效。' : '开启后统一穿白色 T 恤、白色短裤并赤脚；默认关闭。'}
              </small>
            </span>
            <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${activeRecord.whiteBaseOutfit && !activeRecord.clothingImages.length ? 'bg-[#ed6d46]' : 'bg-[#d8e2ec]'}`}>
              <input
                type="checkbox"
                checked={activeRecord.whiteBaseOutfit}
                disabled={isGenerating || activeRecord.clothingImages.length > 0}
                onChange={(event) => patchActive({ whiteBaseOutfit: event.target.checked, checkpoint: 'input', step: 'input', agentAnalysis: null, results: [] })}
                className="sr-only"
              />
              <i className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${activeRecord.whiteBaseOutfit && !activeRecord.clothingImages.length ? 'translate-x-5' : 'translate-x-0'}`} />
            </span>
          </label>
        )}

        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isModel ? 'bg-[#f0f4ff] text-[#3b82f6]' : isClothing ? 'bg-[#eefbf5] text-emerald-600' : 'bg-[#fff0e8] text-[#ed6d46]'}`}>{isModel ? <UserRound className="h-5 w-5" /> : isClothing ? <Shirt className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}</div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-[#17243c] dark:text-white">{title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-pastel-muted">{description}</p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-[#fff0e8] px-2.5 py-1 text-xs font-black text-[#d8552e]">{images.length}/{max}</span>
        </div>

        <div className={`grid grid-cols-1 gap-3 ${isModel ? 'sm:grid-cols-2 md:grid-cols-3' : 'xs:grid-cols-2 sm:grid-cols-2 xl:grid-cols-3'}`}>
          {images.map((image, index) => (
            <div key={image.id} className="group relative flex h-full min-h-44 flex-col overflow-hidden rounded-xl border border-pastel-border bg-pastel-bg/30 transition-all hover:border-[#ed6d46]/40 hover:shadow-sm">
              <div
                className="relative h-full min-h-44 flex-1 cursor-zoom-in overflow-hidden bg-white"
              >
                <img
                  src={image.preview}
                  alt={isModel ? `模特${MODEL_SLOTS[index]}` : isClothing ? '服装参考' : `目标场景${index + 1}`}
                  className="h-full w-full cursor-zoom-in object-contain transition-transform duration-200 group-hover:scale-[1.02]"
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedPreview(image.preview || getDataUrl(image))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedPreview(image.preview || getDataUrl(image));
                    }
                  }}
                  aria-label={`放大查看${title}`}
                />
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    openImageCrop(kind, image);
                  }}
                  disabled={isGenerating}
                  className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg border border-white/30 bg-black/45 text-white shadow-sm backdrop-blur-sm transition hover:bg-black/65 disabled:opacity-40"
                  title="裁切图片"
                  aria-label="裁切图片"
                >
                  <Crop className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeUploadedImage(kind, image.id);
                  }}
                  disabled={isGenerating}
                  className="absolute right-12 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg border border-white/30 bg-black/45 text-white shadow-sm backdrop-blur-sm transition hover:bg-red-500/85 disabled:opacity-40"
                  aria-label="删除图片"
                  title="删除图片"
                >
                  <X className="h-4 w-4" />
                </button>
                <span className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-md bg-black/45 px-2 py-1 text-[0.68rem] font-bold text-white backdrop-blur-sm">
                  {isModel ? MODEL_SLOTS[index] : isClothing ? '服装参考' : `场景 ${index + 1}`}
                </span>
              </div>
            </div>
          ))}

          {images.length < max ? (
            <button
              type="button"
              onClick={() => { activateUploadKind(kind); inputRef.current?.click(); }}
              onDragOver={(event) => { event.preventDefault(); activateUploadKind(kind); }}
              onDrop={(event) => { event.preventDefault(); activateUploadKind(kind); void processFiles(Array.from(event.dataTransfer.files), kind); }}
              className={`flex min-h-36 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cbd8e8] bg-[#f8fbff] p-4 text-center transition-colors hover:border-[#ed6d46] sm:min-h-44 ${images.length === 0 ? 'col-span-full' : ''}`}
            >
              <Upload className="mb-2 h-7 w-7 text-[#ed6d46]" />
              <span className="text-sm font-black text-[#17243c] dark:text-white">点击或拖入图片</span>
              <span className="mt-1 text-xs text-pastel-muted">选中此区域后也可 Ctrl+V</span>
            </button>
          ) : null}
        </div>
        <input ref={inputRef} type="file" accept="image/*" multiple={!isClothing} className="hidden" onChange={(event) => { void processFiles(Array.from(event.target.files || []), kind); event.target.value = ''; }} />
      </section>
    );
  };

  return (
    <div className="h-full overflow-y-auto bg-[#eef6ff] text-pastel-text dark:bg-[#080a0d]">
      <div className="mx-auto w-full max-w-[105rem] px-3 py-5 sm:px-5 lg:px-8">
        {/* Hero shell follows SceneGenerationTab; copy stays specific to model transfer. */}
        <header className="relative mb-5 overflow-hidden rounded-[1.75rem] border border-[#d9e5f1] bg-white px-4 py-6 shadow-[0_14px_45px_rgba(33,66,104,0.07)] dark:border-white/10 dark:bg-[#11151c] sm:px-7 sm:py-7">
          <div className="absolute -right-16 -top-24 h-56 w-56 rounded-full border-[2rem] border-[#edf5fd] bg-[#fff2e9] dark:border-white/[0.03] dark:bg-[#ed6d46]/5" />
          <div className="relative text-center">
            <div className="inline-flex items-center gap-2 text-xs font-black tracking-[0.14em] text-[#6f8199]"><Sparkles className="h-4 w-4 text-[#ed6d46]" />AI 模特迁移 Agent</div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-[#142139] dark:text-white sm:text-3xl">高精模特迁移与人脸融合</h1>
            <p className="mx-auto mt-2 max-w-3xl text-sm leading-6 text-pastel-muted">锁定同一模特的身份特征与目标场景光影，通过人物、姿态与构图约束完成自然稳定的商业级迁移。</p>
            <WorkflowSteps step={activeRecord.step} />
          </div>
        </header>

        {/* Floating Bottom-Left Collapsed Record Button (Matches SceneGenerationTab 1:1) */}
        {!isHistoryOpen && (
          <button
            type="button"
            onClick={() => setIsHistoryOpen(true)}
            className="fixed bottom-5 left-4 z-40 flex min-h-12 items-center gap-2 rounded-full border border-pastel-border bg-white px-4 text-sm font-black shadow-[0_8px_24px_rgba(30,50,80,0.16)] md:left-[16.25rem] lg:left-[17rem] dark:bg-[#11151c] dark:border-white/10 dark:text-white"
          >
            <PanelLeftOpen className="h-4 w-4 text-[#ed6d46]" />
            生成记录
            <span className="rounded-full bg-pastel-bg px-2 py-1 text-xs text-pastel-muted dark:bg-white/10">{records.length}</span>
          </button>
        )}
        {isHistoryOpen && <button type="button" className="fixed inset-0 z-[69] bg-[#10203a]/35 xl:hidden" onClick={() => setIsHistoryOpen(false)} aria-label="关闭生成记录" />}

        {/* Same responsive workbench grid as SceneGenerationTab. */}
        <div className={`grid grid-cols-1 gap-5 ${isHistoryOpen ? 'xl:grid-cols-[17rem_minmax(23rem,31rem)_minmax(0,1fr)]' : 'xl:grid-cols-[minmax(23rem,31rem)_minmax(0,1fr)]'}`}>
          
          {/* Left Column: History Panel */}
          {isHistoryOpen && (
            <div className="fixed inset-y-3 left-3 z-[70] w-[min(18rem,calc(100vw-1.5rem))] xl:sticky xl:top-4 xl:z-10 xl:h-[calc(100vh-7rem)] xl:w-auto xl:self-start">
              {historyPanel}
            </div>
          )}

          {/* Middle Column: Controls Panel */}
          <div className="flex min-w-0 flex-col gap-4">

            {/* Model & Outfit Strategy Card */}
            <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c] sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-black text-[#17243c] dark:text-white">生成模型</h2>
                  <p className="mt-1 text-xs leading-5 text-pastel-muted">选择负责身份提取、人物融合与场景重绘的图像模型。</p>
                </div>
                <span className="rounded-full bg-[#fff0e8] px-2.5 py-1 text-[0.65rem] font-black text-[#d8552e]">推荐</span>
              </div>

              {/* Model Options */}
              <CreativeImageModelSelector value={activeRecord.selectedModel} onChange={(selectedModel) => patchActive({ selectedModel })} disabled={isGenerating} title="" compact className="mt-4 border-0 bg-transparent p-0 shadow-none" />
              <div className="hidden">
                {MODEL_OPTIONS.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => patchActive({ selectedModel: model.id })}
                    disabled={isGenerating}
                    className={`flex min-h-14 flex-col items-center justify-center rounded-xl border p-2 text-center transition-all ${
                      activeRecord.selectedModel === model.id
                        ? 'border-[#ed6d46] bg-[#fff8f3] text-[#d8552e] font-black shadow-2xs'
                        : 'border-pastel-border bg-white text-pastel-text hover:border-[#efb49d]'
                    }`}
                  >
                    <span className="text-xs font-black">{model.label}</span>
                    <span className="mt-0.5 text-[10px] opacity-70">{model.desc}</span>
                  </button>
                ))}
              </div>

            </section>

            {renderUploadArea('model')}
            {renderUploadArea('clothing')}
            {renderUploadArea('scene')}

            {/* Scene, framing and output settings — aligned with SceneGenerationTab. */}
            <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c]">
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" disabled={isGenerating} onClick={() => setSelectionModal('board')} className="flex min-h-16 flex-col justify-center rounded-xl border border-pastel-border bg-pastel-bg p-3 text-left transition hover:border-[#ed6d46]">
                  <span className="text-[0.68rem] font-bold text-pastel-muted">场景模块</span>
                  <div className="mt-1 flex items-center justify-between">
                    <strong className="flex items-center gap-1.5 text-sm font-black text-pastel-text"><span className="text-base">{SCENE_BOARD_CONFIGS[activeRecord.boardType].icon}</span><span>{SCENE_BOARD_CONFIGS[activeRecord.boardType].label}</span></strong>
                    <ChevronRight className="h-4 w-4 text-pastel-muted" />
                  </div>
                </button>
                <div className="min-h-16 rounded-xl border border-pastel-border bg-pastel-bg p-3 text-left">
                  <span className="text-[0.68rem] font-bold text-pastel-muted">模特实际身高（选填）</span>
                  <input value={activeRecord.modelHeight} onChange={(event) => patchActive({ modelHeight: event.target.value })} disabled={isGenerating} className="mt-1 w-full bg-transparent text-sm font-black text-pastel-text outline-none" placeholder="如 168cm" />
                </div>
              </div>

              <label className="mt-4 block text-xs font-black text-pastel-muted">
                一句话描述场景与人物迁移要求（选填）
                <textarea value={activeRecord.extraNotes} onChange={(event) => patchActive({ extraNotes: event.target.value })} disabled={isGenerating} className="mt-1 min-h-24 w-full resize-y rounded-xl border border-pastel-border bg-pastel-bg px-3 py-3 text-sm leading-6 text-pastel-text outline-none focus:border-[#ed6d46]" placeholder="例如：都市街拍场景、保留目标服装、自然侧脸视线、黄昏柔光…" />
              </label>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <button type="button" disabled={isGenerating} onClick={() => setSelectionModal('crop')} className="flex min-h-16 flex-col justify-center rounded-xl border border-pastel-border bg-pastel-bg p-3 text-left transition hover:border-[#ed6d46]">
                  <span className="text-[0.68rem] font-bold text-pastel-muted">截图范围</span>
                  <div className="mt-1 flex items-center justify-between"><strong className="flex items-center gap-1 text-sm font-black text-[#17243c]"><span>{cropFramingById(activeRecord.cropFraming).icon}</span><span className="truncate">{cropFramingById(activeRecord.cropFraming).shortLabel}</span></strong><ChevronRight className="h-4 w-4 text-pastel-muted" /></div>
                </button>
                <button type="button" disabled={isGenerating} onClick={() => setSelectionModal('ratio')} className="flex min-h-16 flex-col justify-center rounded-xl border border-pastel-border bg-pastel-bg p-3 text-left transition hover:border-[#ed6d46]">
                  <span className="text-[0.68rem] font-bold text-pastel-muted">尺寸比例</span>
                  <div className="mt-1 flex items-center justify-between"><strong className="text-sm font-black text-pastel-text">{ECOMMERCE_RATIOS.find((ratio) => ratio.id === activeRecord.aspectRatio)?.label || activeRecord.aspectRatio}</strong><ChevronRight className="h-4 w-4 text-pastel-muted" /></div>
                </button>
                <label className="min-h-16 rounded-xl border border-pastel-border bg-pastel-bg p-3 text-left">
                  <span className="text-[0.68rem] font-bold text-pastel-muted">分辨率</span>
                  <select value={activeRecord.resolution} disabled={isGenerating} onChange={(event) => patchActive({ resolution: event.target.value as ImageResolution })} className="mt-1 min-h-8 w-full bg-transparent text-sm font-black text-pastel-text outline-none"><option value={ImageResolution.RES_1K}>1K</option><option value={ImageResolution.RES_2K}>2K（默认）</option><option value={ImageResolution.RES_4K}>4K</option></select>
                </label>
              </div>

              <div className="mt-4">
                <span className="text-xs font-black text-pastel-muted">生成数量（每个目标场景）</span>
                <div className="mt-2 grid grid-cols-6 gap-2">
                  {[1, 2, 3, 4, 5, 6].map((count) => <button key={count} type="button" disabled={isGenerating} onClick={() => patchActive({ outputCount: count })} className={`min-h-11 rounded-xl border text-sm font-black ${activeRecord.outputCount === count ? 'border-[#ed6d46] bg-[#fff2eb] text-[#d8552e]' : 'border-pastel-border bg-white text-pastel-muted'}`}>{count}</button>)}
                </div>
              </div>
            </section>

            {/* One-Click Toggle Card */}
            <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c]">

              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-pastel-border bg-pastel-bg/40 p-3">
                <span>
                  <strong className="block text-xs font-black text-[#17243c] dark:text-white">一键全流程自动迁移</strong>
                  <small className="block text-[0.68rem] text-pastel-muted">跳过 Agent 分步确认，自动完成分析与迁移</small>
                </span>
                <span className={`relative h-6 w-11 rounded-full transition ${activeRecord.oneClick ? 'bg-[#ed6d46]' : 'bg-[#d8e2ec]'}`}>
                  <input
                    type="checkbox"
                    checked={activeRecord.oneClick}
                    disabled={isGenerating}
                    onChange={(event) => patchActive({ oneClick: event.target.checked })}
                    className="sr-only"
                  />
                  <i className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${activeRecord.oneClick ? 'translate-x-5' : 'translate-x-0'}`} />
                </span>
              </label>
            </section>

            {/* Agent Action Step Buttons */}
            {activeRecord.checkpoint === 'input' && (
              <button
                type="button"
                onClick={() => void runStep1_Analyze()}
                disabled={!canGenerate}
                className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#17243c] text-sm font-black text-white shadow-[0_14px_28px_rgba(23,36,60,0.18)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5 text-[#ff9b67]" />}
                {isGenerating ? 'Agent 正在分析中...' : '开始 Agent 分步分析与迁移'}
              </button>
            )}

            {activeRecord.checkpoint === 'complete' && !isGenerating && (
              <button
                type="button"
                onClick={startNewRecord}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-pastel-border bg-white text-xs font-black text-[#17243c] hover:border-[#ed6d46] hover:text-[#ed6d46]"
              >
                <RotateCcw className="h-4 w-4" /> 重新开始（保留全部素材）
              </button>
            )}

            {isGenerating && (
              <button type="button" onClick={handleCancelGenerate} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 px-4 py-3 text-sm font-bold text-white">
                <X className="h-4 w-4" /> 中止全部任务
              </button>
            )}
            {!isGenerating && activeRecord.statusMessage ? <p className="text-center text-sm font-bold text-[#d8552e]">{activeRecord.statusMessage}</p> : null}
            {activeRecord.error && <p className="text-center text-xs font-bold text-red-500">{activeRecord.error}</p>}
          </div>

          {/* Right Column: Agent Checkpoints & Results Canvas */}
          <div className="flex min-w-0 flex-col gap-4">
            
            {/* Agent Checkpoint Status Banner & Diagnosis Panel */}
            {!isGenerating && activeRecord.checkpoint !== 'input' && activeRecord.checkpoint !== 'complete' && activeRecord.agentAnalysis && (
              <section className="rounded-2xl border border-orange-200 bg-gradient-to-b from-[#fffaf6] to-white p-5 shadow-sm dark:bg-[#11151c]">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-orange-100/80 pb-3">
                  <div>
                    <span className="text-[0.68rem] font-black tracking-[0.14em] text-[#ed6d46]">AGENT DIAGNOSIS & CHECKPOINT</span>
                    <h3 className="mt-0.5 text-base font-black text-[#17243c] dark:text-white">
                      Agent 光影诊断与把关报告
                    </h3>
                  </div>
                  <span className={`rounded-full px-3.5 py-1 text-xs font-black shadow-2xs shrink-0 ${
                    activeRecord.agentAnalysis.isReadyToGenerate
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      : 'bg-amber-50 text-amber-600 border border-amber-200'
                  }`}>
                    {activeRecord.agentAnalysis.isReadyToGenerate ? '🟢 评估通过 · 推荐直接生成' : '🟡 建议优化参考图后生成'}
                  </span>
                </div>

                {/* 2-Column Diagnosis Grid */}
                <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* Lighting Diagnosis */}
                  <div className="rounded-xl border border-pastel-border bg-white p-3.5 shadow-2xs dark:bg-black/20">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-black text-[#17243c] dark:text-white">
                        <Sun className="h-4 w-4 text-[#ed6d46]" /> 光影匹配诊断
                      </span>
                      <span className={`text-[10px] font-black rounded-md px-1.5 py-0.5 ${
                        activeRecord.agentAnalysis.lightingQuality === 'perfect'
                          ? 'bg-emerald-100 text-emerald-700'
                          : activeRecord.agentAnalysis.lightingQuality === 'good'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {activeRecord.agentAnalysis.lightingQuality === 'perfect' ? '光影完美契合' : activeRecord.agentAnalysis.lightingQuality === 'good' ? '光影基调符合' : '建议补光修正'}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-pastel-muted">
                      {activeRecord.agentAnalysis.lightingAnalysis}
                    </p>
                  </div>

                  {/* Face Quality Recommendation */}
                  <div className="rounded-xl border border-pastel-border bg-white p-3.5 shadow-2xs dark:bg-black/20">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-black text-[#17243c] dark:text-white">
                        <UserRound className="h-4 w-4 text-[#ed6d46]" /> 模特人脸质量评估
                      </span>
                      <span className={`text-[10px] font-black rounded-md px-1.5 py-0.5 ${
                        activeRecord.agentAnalysis.faceQuality === 'excellent'
                          ? 'bg-emerald-100 text-emerald-700'
                          : activeRecord.agentAnalysis.faceQuality === 'adequate'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {activeRecord.agentAnalysis.faceQuality === 'excellent' ? '人脸极高清' : activeRecord.agentAnalysis.faceQuality === 'adequate' ? '人脸清晰' : '建议上传更佳正面图'}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-pastel-muted">
                      {activeRecord.agentAnalysis.faceRecommendation}
                    </p>
                  </div>
                </div>

                {/* Outfit Strategy */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#fff8f3] px-3.5 py-2.5 border border-orange-100">
                  <span className="text-xs font-black text-[#d8552e]">服装规则：{getOutfitRuleLabel(activeRecord)}</span>
                  <span className="text-xs text-pastel-muted">服装参考图优先，其次为白色基础服装开关，最后保留目标场景服装。</span>
                </div>

                {/* Head Angle & Gaze Alignment Bar */}
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-blue-50/80 via-[#fff8f3] to-orange-50/80 px-3.5 py-2.5 border border-blue-200/60 shadow-2xs">
                  <span className="flex items-center gap-1.5 text-xs font-black text-[#17243c]">
                    <Eye className="h-4 w-4 text-[#ed6d46]" />
                    <span>头部视角与视线神情把关：</span>
                    <span className="text-[#d8552e]">3/4 侧脸与同角度视线复刻</span>
                  </span>
                  <span className="text-xs text-pastel-muted">
                    {activeRecord.agentAnalysis.gazeAndPoseAnalysis || '已锁定目标场景 3/4 侧脸角度与镜头外视线神情，强制防止生成死板正脸。'}
                  </span>
                </div>

                {/* Collapsible Full AI Prompt Inspector */}
                <div className="mt-3 border-t border-pastel-border/60 pt-3">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setIsPromptExpanded(!isPromptExpanded)}
                      className="flex items-center gap-1.5 text-xs font-black text-[#17243c] dark:text-white hover:text-[#ed6d46] transition-colors"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5 text-[#ed6d46]" />
                      <span>查看 / 复制 Agent 调优 Prompt 提示词</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${isPromptExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {isPromptExpanded && (
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(activeRecord.agentAnalysis?.generatedPrompt || '');
                          setIsPromptCopied(true);
                          setTimeout(() => setIsPromptCopied(false), 2000);
                        }}
                        className="flex items-center gap-1 text-xs font-black text-[#d8552e] hover:underline"
                      >
                        {isPromptCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : null}
                        <span>{isPromptCopied ? '已复制 Prompt' : '一键复制 Prompt'}</span>
                      </button>
                    )}
                  </div>

                  {isPromptExpanded && (
                    <div className="mt-2.5 rounded-xl bg-slate-900 p-3.5 text-xs font-mono text-orange-200 leading-relaxed overflow-x-auto border border-slate-700 shadow-inner">
                      <p className="whitespace-pre-wrap selection:bg-[#ed6d46] selection:text-white">
                        {activeRecord.agentAnalysis.generatedPrompt}
                      </p>
                    </div>
                  )}
                </div>

                {activeRecord.checkpoint === 'analyzed' && (
                  <div className="mt-4 grid gap-2 border-t border-orange-100 pt-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <button
                      type="button"
                      onClick={() => {
                        const analysis = activeRecord.agentAnalysis || fallbackAnalysis(activeRecord.extraNotes);
                        patchActive({ checkpoint: 'confirmed', step: 'color', statusMessage: '方案已确认，正在开始生成。' });
                        void runStep3_FinalTransfer(activeRecord.id, analysis);
                      }}
                      className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#17243c] px-6 text-sm font-black text-white shadow-[0_12px_24px_rgba(23,36,60,0.18)] transition hover:-translate-y-0.5"
                    >
                      <Sparkles className="h-5 w-5 text-[#ff9b67]" />
                      确认方案，生成 {activeRecord.targetScenes.length * activeRecord.outputCount} 张
                    </button>
                    <button
                      type="button"
                      onClick={() => void runStep1_Analyze()}
                      className="min-h-14 rounded-xl border border-pastel-border bg-white px-5 text-xs font-black text-pastel-muted hover:border-[#ed6d46] hover:text-[#d8552e]"
                    >
                      重新分析
                    </button>
                  </div>
                )}
              </section>
            )}

            {/* Empty State placeholder */}
            {activeRecord.checkpoint === 'input' && !isGenerating && !activeRecord.results.length && (
              <section className="flex min-h-[34rem] flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#cedbe8] bg-white/75 p-8 text-center">
                <span className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-[#fff1e8] text-[#ed6d46]">
                  <UserRound className="h-9 w-9" />
                </span>
                <h2 className="mt-5 text-xl font-black text-[#17243c]">先锁定人物身份，再选择目标场景</h2>
                <p className="mt-2 max-w-lg text-sm leading-7 text-pastel-muted">
                  Agent 会从多角度参考图中提取稳定身份特征，并将人物自然融入目标场景；所有上传图片均可先放大裁切。
                </p>
                <div className="mt-6 grid w-full max-w-xl gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-white p-3 text-left shadow-sm"><UserRound className="h-4 w-4 text-[#ed6d46]" /><strong className="mt-2 block text-xs">1–3张身份参考</strong></div>
                  <div className="rounded-xl bg-white p-3 text-left shadow-sm"><Crop className="h-4 w-4 text-[#2d6bb1]" /><strong className="mt-2 block text-xs">图片放大与裁切</strong></div>
                  <div className="rounded-xl bg-white p-3 text-left shadow-sm"><Sparkles className="h-4 w-4 text-emerald-600" /><strong className="mt-2 block text-xs">光影自然融合</strong></div>
                </div>
              </section>
            )}

            {/* Results Canvas Viewport */}
            {(activeRecord.results.length > 0 || isGenerating) && (
              <section className="flex min-h-[36rem] flex-1 flex-col rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c] sm:p-5 xl:min-h-[42rem]">
                <style>{`
                  @keyframes scanBeam {
                    0% { top: 0%; opacity: 0.2; }
                    15% { opacity: 1; }
                    85% { opacity: 1; }
                    100% { top: 96%; opacity: 0.2; }
                  }
                  .animate-scan-beam {
                    animation: scanBeam 2s ease-in-out infinite alternate;
                  }
                  @keyframes pulseBorder {
                    0%, 100% { border-color: rgba(237, 109, 70, 0.4); box-shadow: 0 0 10px rgba(237, 109, 70, 0.15); }
                    50% { border-color: rgba(237, 109, 70, 0.95); box-shadow: 0 0 25px rgba(237, 109, 70, 0.45); }
                  }
                  .animate-pulse-border {
                    animation: pulseBorder 1.8s ease-in-out infinite;
                  }
                `}</style>
                {/* AI Work Status Banner (When Generating) */}
                {isGenerating && (
                  <div className="mb-4 flex items-center justify-between rounded-xl bg-gradient-to-r from-[#17243c] via-[#233554] to-[#17243c] px-4 py-3 text-white shadow-md border border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-[#ed6d46] text-white shadow-sm">
                        <Sparkles className="h-4.5 w-4.5 animate-spin" />
                      </div>
                      <div>
                        <span className="block text-[0.68rem] font-black tracking-wider text-orange-300">AI AGENT 工作调度中</span>
                        <span className="block text-xs font-bold text-white/90">{statusMessage || '深度提取源模特五官与目标场景光影基调...'}</span>
                      </div>
                    </div>
                    <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-orange-200 backdrop-blur-sm shrink-0">
                      <span className="h-2 w-2 rounded-full bg-[#ed6d46] animate-ping" /> 进行中
                    </span>
                  </div>
                )}

                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-[#ed6d46]" />
                    <h3 className="text-lg font-black text-[#17243c] dark:text-white">迁移生成结果</h3>
                    {activeRecord.results.length ? <span className="text-xs font-bold text-pastel-muted">{completedCount}/{activeRecord.results.length}</span> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {activeRecord.results.some((item) => item.imageUrl) && !isGenerating && (
                      <button
                        type="button"
                        onClick={handleDownloadAll}
                        className="flex min-h-11 items-center gap-2 rounded-xl bg-[#17243c] px-4 text-xs font-black text-white hover:bg-[#253858] shadow-sm"
                      >
                        <Download className="h-4 w-4" />全部下载
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border-2 border-dashed border-[#cbd8e8] bg-[#f8fbff] p-3 dark:bg-black/20">
                  {/* Case 1: Initial Step 1 Analyzing animation (before result objects are created) */}
                  {isGenerating && activeRecord.results.length === 0 && (
                    <div className="no-scrollbar grid w-full grid-cols-1 content-start gap-4 overflow-y-auto p-2 sm:grid-cols-2">
                      {(activeRecord.targetScenes.length ? activeRecord.targetScenes : [{ id: '1', preview: '', base64: '', mime: '', name: '示例' }]).map((scene, idx) => (
                        <article key={scene.id || idx} className="group relative overflow-hidden rounded-2xl border-2 border-[#ed6d46] bg-slate-950 shadow-xl animate-pulse-border">
                          <div className={`relative w-full ${getCardAspectRatioClass(activeRecord.aspectRatio)} overflow-hidden bg-slate-950`}>
                            {scene.base64 ? (
                              <img src={getDataUrl(scene)} alt={`场景 ${idx + 1}`} className="h-full w-full object-cover opacity-70 filter brightness-95" />
                            ) : (
                              <div className="h-full w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
                            )}

                            {/* Glowing Laser Scan Line Animation */}
                            <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#ed6d46] to-transparent shadow-[0_0_16px_#ed6d46] animate-scan-beam z-20 pointer-events-none" />
                            <div className="absolute inset-0 bg-gradient-to-b from-[#ed6d46]/10 via-transparent to-black/75 pointer-events-none z-10" />

                            {/* Top Glassmorphism Status Badge */}
                            <div className="absolute top-3 left-3 z-30 flex items-center gap-2 rounded-full bg-black/80 px-3.5 py-1 text-xs font-black text-white backdrop-blur-md border border-white/20 shadow-md">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ed6d46] opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ed6d46]"></span>
                              </span>
                              <span>AI AGENT 分析中</span>
                            </div>

                            {/* Bottom Integrated Status Bar */}
                            <div className="absolute bottom-0 inset-x-0 z-30 flex items-center justify-between gap-2 bg-gradient-to-t from-black/90 via-black/75 to-transparent px-4 py-3 text-white border-t border-white/10 backdrop-blur-xs">
                              <div className="min-w-0">
                                <span className="block text-xs font-black text-white truncate">场景 {idx + 1}</span>
                                <span className="block text-[10px] text-orange-300 font-bold truncate">
                                  {statusMessage || '锁定人脸轮廓与光影基调中'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 text-xs font-bold text-[#ff9b67]">
                                <Loader2 className="h-4 w-4 animate-spin text-[#ed6d46]" />
                                <span>识别中</span>
                              </div>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}

                  {/* Case 2: Standard Results Display with Laser Scanning overlays on pending items */}
                  {activeRecord.results.length > 0 && (
                    <div className="no-scrollbar grid w-full grid-cols-1 content-start gap-4 overflow-y-auto p-2 sm:grid-cols-2">
                      {activeRecord.results.map((item, index) => (
                        <article key={item.id} className={`group relative overflow-hidden rounded-2xl border ${!item.imageUrl && isGenerating ? 'border-2 border-[#ed6d46] animate-pulse-border' : 'border-pastel-border'} bg-white shadow-md`}>
                          <div className={`relative w-full ${getCardAspectRatioClass(activeRecord.aspectRatio)} overflow-hidden bg-slate-950`}>
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={`模特迁移 ${index + 1}`} className="h-full w-full object-contain cursor-zoom-in" onClick={() => setSelectedPreview(item.imageUrl!)} />
                            ) : item.status === 'error' || item.status === 'cancelled' ? (
                              <div className="flex h-full w-full items-center justify-center p-5 text-center text-sm font-bold text-red-500">{item.error || statusLabel(item.status)}</div>
                            ) : (
                              <div className="relative h-full w-full overflow-hidden">
                                {activeRecord.targetScenes.find((scene) => scene.id === item.sceneId) && (
                                  <img src={getDataUrl(activeRecord.targetScenes.find((scene) => scene.id === item.sceneId)!)} alt="Target Scene" className="h-full w-full object-cover opacity-70 filter brightness-95" />
                                )}

                                {/* Glowing Laser Scan Line Animation */}
                                <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#ed6d46] to-transparent shadow-[0_0_16px_#ed6d46] animate-scan-beam z-20 pointer-events-none" />
                                <div className="absolute inset-0 bg-gradient-to-b from-[#ed6d46]/10 via-transparent to-black/75 pointer-events-none z-10" />

                                {/* Top Glassmorphism Status Badge */}
                                <div className="absolute top-3 left-3 z-30 flex items-center gap-2 rounded-full bg-black/80 px-3.5 py-1 text-xs font-black text-white backdrop-blur-md border border-white/20 shadow-md">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ed6d46] opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ed6d46]"></span>
                                  </span>
                                  <span>{statusLabel(item.status)}</span>
                                </div>

                                {/* Bottom Integrated Status Bar */}
                                <div className="absolute bottom-0 inset-x-0 z-30 flex items-center justify-between gap-2 bg-gradient-to-t from-black/90 via-black/75 to-transparent px-4 py-3 text-white border-t border-white/10 backdrop-blur-xs">
                                  <div className="min-w-0">
                                    <span className="block text-xs font-black text-white truncate">{item.sceneName || `场景 ${index + 1}`}</span>
                                    <span className="block text-[10px] text-orange-300 font-bold truncate">融合光影与完成超清渲染中</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0 text-xs font-bold text-[#ff9b67]">
                                    <Loader2 className="h-4 w-4 animate-spin text-[#ed6d46]" />
                                    <span>处理中</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex min-h-14 items-center justify-between gap-2 border-t border-pastel-border px-3 bg-white">
                            <div className="min-w-0">
                              <div className="truncate text-xs font-black text-pastel-text">场景 {index + 1}</div>
                              <div className="truncate text-xs text-pastel-muted">{statusLabel(item.status)}</div>
                            </div>
                            <div className="flex shrink-0 gap-1">
                              {item.imageUrl && (
                                <button type="button" onClick={() => setSelectedPreview(item.imageUrl!)} disabled={isWorkingStatus(item.status)} className="flex h-9 w-9 items-center justify-center rounded-lg text-pastel-muted hover:bg-pastel-bg" aria-label="预览">
                                  <Maximize className="h-4 w-4" />
                                </button>
                              )}
                              <button type="button" onClick={() => void runStep3_FinalTransfer()} disabled={isGenerating} className="flex h-9 w-9 items-center justify-center rounded-lg text-pastel-muted hover:bg-[#fff0e8] hover:text-[#ed6d46]" aria-label="重试">
                                <RefreshCw className={`h-4 w-4 ${item.imageUrl && isWorkingStatus(item.status) ? 'animate-spin' : ''}`} />
                              </button>
                              {item.imageUrl && (
                                <button type="button" onClick={() => handleDownload(item.imageUrl!, index)} disabled={isWorkingStatus(item.status)} className="flex h-9 w-9 items-center justify-center rounded-lg text-pastel-muted hover:bg-emerald-50 hover:text-emerald-600" aria-label="下载">
                                  <Download className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
                {isGenerating && statusMessage ? <p className="mt-3 text-center text-xs font-bold text-[#d8552e]">{statusMessage}</p> : null}
              </section>
            )}
          </div>

        </div>
      </div>

      {imageCrop && (
        <ImageCropModal
          key={`${imageCrop.recordId}-${imageCrop.imageId}-${imageCrop.url}`}
          target={imageCrop}
          onClose={() => setImageCrop(null)}
          onConfirmCrop={applyImageCrop}
        />
      )}

      {selectionModal === 'ratio' && (
        <SelectionModal title="选择尺寸比例" onClose={() => setSelectionModal(null)}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ECOMMERCE_RATIOS.map((ratio) => {
              const [width, height] = String(ratio.id).split(':').map(Number);
              const scale = 70 / Math.max(width, height);
              const isSelected = activeRecord.aspectRatio === ratio.id;
              return (
                <button key={ratio.id} type="button" onClick={() => { patchActive({ aspectRatio: ratio.id }); setSelectionModal(null); }} className={`relative flex min-h-44 flex-col items-center justify-center rounded-2xl border-2 p-4 transition hover:-translate-y-1 ${isSelected ? 'border-[#17243c] bg-white shadow-lg' : 'border-transparent bg-pastel-bg/60'}`}>
                  <span className="block rounded border-[3px] border-[#7a8492]" style={{ width: Math.max(24, width * scale), height: Math.max(24, height * scale) }} />
                  <strong className="mt-4 text-base font-black text-[#17243c]">{ratio.label}</strong>
                  {isSelected && <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-[#17243c]" />}
                </button>
              );
            })}
          </div>
        </SelectionModal>
      )}

      {selectionModal === 'board' && (
        <SelectionModal title="选择场景模块" onClose={() => setSelectionModal(null)}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(SCENE_BOARD_CONFIGS) as BoardType[]).map((key) => {
              const board = SCENE_BOARD_CONFIGS[key];
              const isSelected = activeRecord.boardType === key;
              return (
                <button key={key} type="button" onClick={() => { patchActive({ boardType: key }); setSelectionModal(null); }} className={`relative flex min-h-32 flex-col justify-between rounded-2xl border-2 p-4 text-left transition hover:-translate-y-1 ${isSelected ? 'border-[#ed6d46] bg-[#fff8f3] shadow-md' : 'border-transparent bg-pastel-bg/60'}`}>
                  <div className="flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xl shadow-sm">{board.icon}</span>{isSelected && <CheckCircle2 className="h-5 w-5 text-[#ed6d46]" />}</div>
                  <div className="mt-3"><strong className="block text-base font-black text-[#17243c]">{board.label}</strong><small className="mt-1 block text-xs leading-4 text-pastel-muted">{board.description}</small></div>
                </button>
              );
            })}
          </div>
        </SelectionModal>
      )}

      {selectionModal === 'crop' && (
        <SelectionModal title="选择截图范围" onClose={() => setSelectionModal(null)}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CROP_FRAMING_OPTIONS.map((option) => {
              const isSelected = activeRecord.cropFraming === option.id;
              return (
                <button key={option.id} type="button" onClick={() => { patchActive({ cropFraming: option.id }); setSelectionModal(null); }} className={`relative flex min-h-36 flex-col justify-between rounded-2xl border-2 p-4 text-left transition hover:-translate-y-1 ${isSelected ? 'border-[#ed6d46] bg-[#fff8f3] shadow-md' : 'border-transparent bg-pastel-bg/60'}`}>
                  <div className="flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xl shadow-sm">{option.icon}</span>{isSelected && <CheckCircle2 className="h-5 w-5 text-[#ed6d46]" />}</div>
                  <div className="mt-3"><strong className="block text-base font-black text-[#17243c]">{option.label}</strong><small className="mt-1 block text-xs leading-5 text-pastel-muted">{option.description}</small></div>
                </button>
              );
            })}
          </div>
        </SelectionModal>
      )}

      {/* Fullscreen Image Preview */}
      {selectedPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setSelectedPreview(null)}>
          <button type="button" onClick={() => setSelectedPreview(null)} className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white" aria-label="关闭预览">
            <X className="h-6 w-6" />
          </button>
          <img src={selectedPreview} alt="模特迁移大图预览" className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg" />
        </div>
      )}
    </div>
  );
};

export default ModelTransferTab;
