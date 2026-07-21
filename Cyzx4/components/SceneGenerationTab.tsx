import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Brain,
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  Image as ImageIcon,
  Languages,
  LayoutTemplate,
  Loader2,
  Maximize2,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Sparkles,
  Store,
  Trash2,
  Upload,
  Wand2,
  WandSparkles,
  X,
} from 'lucide-react';
import { AspectRatio, ImageResolution } from '../types';
import { compressImage, generateImageToImage, generateText } from '../services/geminiService';
import { useImagePaste } from '../hooks/useImagePaste';
import { useCancelableGeneration } from '../hooks/useCancelableGeneration';
import { getErrorMessage, isAbortError } from '../utils/apiHelpers';
import { saveGeneratedProject } from '../../services/projectHistoryService';
import { ecommerceStyleLibrary } from '../services/ecommerceStyleLibrary';
import {
  ECOMMERCE_RATIOS,
  ECOMMERCE_STYLE_PRESETS,
  stylePresetById,
  type EcommerceStylePreset,
} from '../constants/ecommerceHeroPresets';
import type {
  EcommerceCustomStyle,
  EcommerceStyleAnalysis,
} from '../types/ecommerceHero.types';
import './SceneGenerationTab.css';

export type BoardType = 'main' | 'aplus' | 'social' | 'story' | 'asset' | 'mobile';

export interface SceneBoardConfig {
  id: BoardType;
  label: string;
  description: string;
  aspectRatio: AspectRatio;
  icon: string;
}

export const SCENE_BOARD_CONFIGS: Record<BoardType, SceneBoardConfig> = {
  main: {
    id: 'main',
    label: '副图',
    description: '亚马逊主副图场景，适合卖点强化与点击转化',
    aspectRatio: AspectRatio.SQUARE,
    icon: '🛒',
  },
  aplus: {
    id: 'aplus',
    label: 'A+',
    description: '详情页横幅场景，适合叙事化展示与品牌表达',
    aspectRatio: AspectRatio.LANDSCAPE_16_9,
    icon: '✨',
  },
  social: {
    id: 'social',
    label: '社媒买家秀',
    description: '真实生活化使用场景，适合种草与社媒传播',
    aspectRatio: AspectRatio.PORTRAIT_3_4,
    icon: '📱',
  },
  story: {
    id: 'story',
    label: '品牌故事',
    description: '电影级超宽场景，适合展示品牌深度与空间氛围',
    aspectRatio: AspectRatio.LANDSCAPE_21_9,
    icon: '🎬',
  },
  asset: {
    id: 'asset',
    label: '品牌资产卡',
    description: '2:3 竖向场景图，适合高转化营销与资产沉淀',
    aspectRatio: AspectRatio.PORTRAIT_2_3,
    icon: '🎴',
  },
  mobile: {
    id: 'mobile',
    label: '手机比例',
    description: '9:16 竖向手机场景，适配移动端详情页与极速交互',
    aspectRatio: AspectRatio.PORTRAIT_9_16,
    icon: '🤳',
  },
};

export interface SceneUploadedImage {
  id: string;
  name: string;
  mime: string;
  base64: string;
  preview: string;
}

export interface SceneHeroAnalysis {
  productIdentity: string;
  productName: string;
  productCategory: string;
  materialColor: string;
  sellingPoints: string[];
  targetAudience: string;
  recommendedBoard: BoardType;
  boardReason: string;
  boardVisualStrategy: string;
  backgroundComposition: string;
  modelPersonaPreset: string;
  modelEthnicity: string;
  modelAgeGroup: string;
  modelFamilyStructure: string;
  modelLifestyle: string;
  cameraDevice: string;
  shotType: string;
  sizeCategory: 'tiny' | 'small' | 'medium' | 'large' | 'wearable';
  imagePlans: string[];
  riskWarnings: string[];
}

export type SceneResultStatus = 'pending' | 'submitting' | 'processing' | 'done' | 'error' | 'cancelled';

export interface SceneHeroResult {
  id: string;
  status: SceneResultStatus;
  prompt: string;
  imageUrl?: string;
  error?: string;
}

export interface SceneGenerationRecord {
  id: string;
  createdAt: number;
  step: 'input' | 'analyzing' | 'confirm' | 'generating' | 'complete';
  mode: 'standard' | 'advanced';
  boardType: BoardType;
  productImages: SceneUploadedImage[];
  referenceSceneImage: SceneUploadedImage | null;
  userHint: string;
  productSize: string;
  modelId: string;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
  outputCount: number;
  oneClick: boolean;
  selectedPresetId: string | null;
  selectedCustomStyleId: string | null;
  analysis: SceneHeroAnalysis | null;
  results: SceneHeroResult[];
  error: string;
}

const MAX_PRODUCT_IMAGES = 10;
const MAX_STYLE_IMAGES = 4;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_RECORDS = 20;
const DEFAULT_MODEL_ID = 'gemini-3.1-flash-image-preview';

const IMAGE_MODEL_OPTIONS: Array<{ id: string; label: string; description: string; badge: string }> = [
  { id: 'gemini-3.1-flash-image-preview', label: 'Gemini Banana 2', description: '快速稳定', badge: '默认' },
  { id: 'gpt-image-2', label: 'GPT Image 2', description: 'Ultra Quality', badge: 'GPT' },
  { id: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro', description: '专业细节', badge: 'Pro' },
];

const ACCEPTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const STEPS: Array<{ id: SceneGenerationRecord['step']; label: string }> = [
  { id: 'input', label: '1. 输入' },
  { id: 'analyzing', label: '2. AI分析' },
  { id: 'confirm', label: '3. 确认规划' },
  { id: 'generating', label: '4. 生成中' },
  { id: 'complete', label: '5. 完成' },
];

const createRecord = (): SceneGenerationRecord => ({
  id: crypto.randomUUID(),
  createdAt: Date.now(),
  step: 'input',
  mode: 'standard',
  boardType: 'social',
  productImages: [],
  referenceSceneImage: null,
  userHint: '',
  productSize: '',
  modelId: DEFAULT_MODEL_ID,
  aspectRatio: AspectRatio.PORTRAIT_2_3,
  resolution: ImageResolution.RES_2K,
  outputCount: 3,
  oneClick: false,
  selectedPresetId: null,
  selectedCustomStyleId: null,
  analysis: null,
  results: [],
  error: '',
});

const toApiImage = (image: SceneUploadedImage) => ({ base64: image.base64, mimeType: image.mime });
const toDataUrl = (image: SceneUploadedImage) => `data:${image.mime};base64,${image.base64}`;
const isWorkingStatus = (status: SceneResultStatus) => ['pending', 'submitting', 'processing'].includes(status);

const normalizeStringList = (value: unknown) => Array.isArray(value)
  ? value.map((item) => String(item).trim()).filter(Boolean)
  : [];

const parseJsonObject = (text: string) => {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Agent 未返回结构化场景方案，请重试。');
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    throw new Error('Agent 结构化解析失败，请重试。');
  }
};

const getSizeCategoryFromStr = (sizeStr: string): 'tiny' | 'small' | 'medium' | 'large' | 'wearable' => {
  const s = sizeStr.toLowerCase().replace(/\s/g, '');
  const cmMatch = s.match(/(\d+(?:\.\d+)?)\s*cm/i);
  const inchMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:inch|inches|in|")/i);
  let cm = 0;
  if (cmMatch) cm = parseFloat(cmMatch[1]);
  else if (inchMatch) cm = parseFloat(inchMatch[1]) * 2.54;
  else {
    const bareMatch = s.match(/^(\d+(?:\.\d+)?)$/);
    if (bareMatch) cm = parseFloat(bareMatch[1]);
  }
  if (cm <= 0) return 'medium';
  if (cm <= 10) return 'tiny';
  if (cm <= 25) return 'small';
  if (cm <= 50) return 'medium';
  return 'large';
};

const parseSceneAnalysis = (
  text: string,
  count: number,
  fallbackBoard: BoardType,
  userProductSize: string,
): SceneHeroAnalysis => {
  const parsed = parseJsonObject(text);
  const required = ['productIdentity', 'productName', 'productCategory', 'materialColor', 'targetAudience', 'boardReason', 'boardVisualStrategy', 'backgroundComposition'];
  if (required.some((key) => typeof parsed[key] !== 'string' || !String(parsed[key]).trim())) {
    throw new Error('Agent 返回的场景方案不完整，请重试。');
  }
  const availableBoards = new Set(['main', 'aplus', 'social', 'story', 'asset', 'mobile']);
  const recommended = availableBoards.has(parsed.recommendedBoard as BoardType)
    ? parsed.recommendedBoard as BoardType
    : fallbackBoard;

  const imagePlans = normalizeStringList(parsed.imagePlans);
  while (imagePlans.length < count) {
    imagePlans.push(`生成第 ${imagePlans.length + 1} 张高转化商业场景视觉，突出商品真实材质与环境氛围。`);
  }

  const derivedSize = userProductSize ? getSizeCategoryFromStr(userProductSize) : (parsed.sizeCategory as any) || 'medium';

  return {
    productIdentity: String(parsed.productIdentity).trim(),
    productName: String(parsed.productName).trim(),
    productCategory: String(parsed.productCategory).trim(),
    materialColor: String(parsed.materialColor).trim(),
    sellingPoints: normalizeStringList(parsed.sellingPoints).slice(0, 6),
    targetAudience: String(parsed.targetAudience).trim(),
    recommendedBoard: recommended,
    boardReason: String(parsed.boardReason).trim(),
    boardVisualStrategy: String(parsed.boardVisualStrategy).trim(),
    backgroundComposition: String(parsed.backgroundComposition).trim(),
    modelPersonaPreset: String(parsed.modelPersonaPreset || '美国都市女性').trim(),
    modelEthnicity: String(parsed.modelEthnicity || '自动匹配').trim(),
    modelAgeGroup: String(parsed.modelAgeGroup || '20-30岁').trim(),
    modelFamilyStructure: String(parsed.modelFamilyStructure || '单人').trim(),
    modelLifestyle: String(parsed.modelLifestyle || '居家生活').trim(),
    cameraDevice: String(parsed.cameraDevice || 'iPhone 实拍').trim(),
    shotType: String(parsed.shotType || '中景半身').trim(),
    sizeCategory: derivedSize,
    imagePlans: imagePlans.slice(0, count),
    riskWarnings: normalizeStringList(parsed.riskWarnings),
  };
};

const parseStyleAnalysis = (text: string): EcommerceStyleAnalysis => {
  const parsed = parseJsonObject(text);
  const stringValue = (key: string, fallback: string) => typeof parsed[key] === 'string' && String(parsed[key]).trim()
    ? String(parsed[key]).trim()
    : fallback;
  return {
    palette: stringValue('palette', '提取参考图的主要色彩基调'),
    lighting: stringValue('lighting', '匹配参考图的光照方向与明效'),
    background: stringValue('background', '提取参考图的背景材质与空间氛围'),
    composition: stringValue('composition', '匹配参考图的主体占比和视觉动线'),
    propDensity: stringValue('propDensity', '克制且不遮挡商品'),
    typographyDensity: stringValue('typographyDensity', '留出自然的环境空间'),
    forbiddenElements: normalizeStringList(parsed.forbiddenElements),
    promptBlock: stringValue('promptBlock', 'Use reference images solely for lighting, palette and lifestyle mood.'),
  };
};

const styleSummary = (record: SceneGenerationRecord, customStyles: EcommerceCustomStyle[]) => {
  const preset = stylePresetById(record.selectedPresetId);
  if (preset) return { name: preset.name, prompt: preset.prompt, references: [] as SceneUploadedImage[] };
  const custom = customStyles.find((item) => item.id === record.selectedCustomStyleId);
  if (!custom) return { name: '默认平台风格', prompt: 'Use realistic commercial photo lighting, harmonious lifestyle colors, crisp product focus.', references: [] as SceneUploadedImage[] };
  return {
    name: custom.name,
    prompt: [custom.analysis.palette, custom.analysis.lighting, custom.analysis.background, custom.analysis.composition, custom.analysis.propDensity, custom.analysis.promptBlock].join('. '),
    references: custom.referenceImages.map((dataUrl, index) => {
      const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      return match ? { id: `${custom.id}-${index}`, name: `${custom.name}-${index + 1}`, mime: match[1], base64: match[2], preview: dataUrl } : null;
    }).filter((item): item is SceneUploadedImage => Boolean(item)),
  };
};

const buildAnalysisPrompt = (record: SceneGenerationRecord, styleName: string, stylePrompt: string) => {
  const board = SCENE_BOARD_CONFIGS[record.boardType];
  const refSceneText = record.referenceSceneImage
    ? `Image ${record.productImages.length + 1} is a REFERENCE SCENE & POSE IMAGE. Extract its exact background environment, lighting, composition, camera perspective, and model pose/action. Create visual plans that faithfully replicate this scene style and pose for the product.`
    : 'No reference scene image provided.';

  return `
You are an expert commercial scene director and product analyst.

Analyze Images 1-${record.productImages.length} as multiple views/angles of ONE identical product SKU.
${refSceneText}

CURRENT SETTINGS
- Scene Board: ${board.label} (${board.description})
- Target Ratio: ${record.aspectRatio}
- Output Count: ${record.outputCount}
- Product Size (User Input): ${record.productSize.trim() || 'Not specified'}
- Scene Hint / User Description: ${record.userHint.trim() || 'Not specified'}
- Visual Style Name: ${styleName}
- Style Direction: ${stylePrompt}

RULES
- Extract absolute product identity (silhouette, texture, colors, key features).
- Recommend exact board type from: main, aplus, social, story, asset, mobile.
- Plan exactly ${record.outputCount} distinct, high-converting commercial lifestyle image plans.
- Output ONLY valid JSON:
{
  "productIdentity":"specific product identity and immutable detail summary",
  "productName":"editable product name in Chinese",
  "productCategory":"specific category in Chinese",
  "materialColor":"materials, finish and exact colors",
  "sellingPoints":["truthful product selling point"],
  "targetAudience":"target audience description",
  "recommendedBoard":"main|aplus|social|story|asset|mobile",
  "boardReason":"Chinese recommendation reason",
  "boardVisualStrategy":"Chinese board visual strategy",
  "backgroundComposition":"Chinese background composition, lighting and space plan",
  "modelPersonaPreset":"recommended persona preset name",
  "modelEthnicity":"ethnicity",
  "modelAgeGroup":"age group",
  "modelFamilyStructure":"family structure",
  "modelLifestyle":"lifestyle environment",
  "cameraDevice":"recommended camera/device",
  "shotType":"recommended shot type",
  "sizeCategory":"tiny|small|medium|large|wearable",
  "imagePlans":["one Chinese visual plan per output"],
  "riskWarnings":["risk to verify"]
}
`.trim();
};

const buildGenerationPrompt = (
  record: SceneGenerationRecord,
  analysis: SceneHeroAnalysis,
  index: number,
  styleName: string,
  stylePrompt: string,
  styleReferenceCount: number,
) => {
  const board = SCENE_BOARD_CONFIGS[record.boardType];
  const productEnd = record.productImages.length;

  let refSceneNote = '';
  if (record.referenceSceneImage) {
    refSceneNote = `- Image ${productEnd + 1} is a REFERENCE SCENE & POSE IMAGE. Replicate its exact scene setting, background composition, lighting mood, camera perspective, and subject pose/gestures faithfully, placing the target product into that replicated scene and pose.`;
  }

  const styleEnd = productEnd + (record.referenceSceneImage ? 1 : 0);
  let styleRefNote = styleReferenceCount
    ? `- Images ${styleEnd + 1}-${styleEnd + styleReferenceCount} are visual style references for color and lighting ONLY.`
    : '- No separate style reference image provided.';

  return `
Create ONE premium commercial scene image, variation ${index + 1} of ${record.outputCount}.

IMAGE ROUTING
- Images 1-${productEnd}: multiple views/details of ONE identical product SKU (Identity lock).
${refSceneNote}
${styleRefNote}

PRODUCT IDENTITY LOCK
- Product: ${analysis.productIdentity}
- Category: ${analysis.productCategory}
- Material/Color: ${analysis.materialColor}
- Size Category: ${analysis.sizeCategory} (Product physical size: ${record.productSize || 'Natural proportion'})
- Preserve exact silhouette, details, textures, branding and construction.

SCENE & BOARD SYSTEM
- Board: ${board.label} (${board.description})
- Strategy: ${analysis.boardVisualStrategy}
- Background & Composition: ${analysis.backgroundComposition}
- Image Plan: ${analysis.imagePlans[index] || analysis.imagePlans[0]}
- Camera / Device: ${analysis.cameraDevice}
- Shot Type: ${analysis.shotType}
- Model Persona: ${analysis.modelPersonaPreset} (${analysis.modelEthnicity}, ${analysis.modelAgeGroup}, ${analysis.modelLifestyle})

STYLE DIRECTION
- Selected Style: ${styleName}
- Style Prompt: ${stylePrompt}

USER HINT
${record.userHint.trim() || 'No extra hint.'}

ABSOLUTE POLICY
- Do NOT render added text, logos, overlays, price tags or watermarks.
- Maintain photorealistic, high-conversion commercial photography quality, exact proportions and true lighting.
- Canvas Aspect Ratio: ${record.aspectRatio}.
`.trim();
};

const readUploadedFiles = async (files: File[], max: number, currentCount: number) => {
  const imageFiles = files.filter((file) => ACCEPTED_MIME_TYPES.has(file.type));
  const accepted = imageFiles.filter((file) => file.size <= MAX_FILE_SIZE).slice(0, Math.max(0, max - currentCount));
  const uploaded = await Promise.all(accepted.map(async (file): Promise<SceneUploadedImage> => {
    const compressed = await compressImage(file, 2048, 0.92);
    return {
      id: crypto.randomUUID(),
      name: file.name,
      mime: compressed.mime,
      base64: compressed.base64,
      preview: `data:${compressed.mime};base64,${compressed.base64}`,
    };
  }));
  return { uploaded, imageFiles, accepted };
};

const WorkflowSteps: React.FC<{ step: SceneGenerationRecord['step'] }> = ({ step }) => {
  const current = STEPS.findIndex((item) => item.id === step);
  return (
    <div className="no-scrollbar mt-4 flex items-center justify-start gap-2 overflow-x-auto pb-1 sm:justify-center">
      {STEPS.map((item, index) => (
        <React.Fragment key={item.id}>
          <div className={`flex min-w-fit items-center gap-2 text-xs font-black ${index <= current ? 'text-[#17243c] dark:text-white' : 'text-[#93a2b6]'}`}>
            <span className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs ${index < current ? 'border-[#ed6d46] bg-[#ed6d46] text-white' : index === current ? 'border-[#17243c] bg-[#17243c] text-white' : 'border-[#d8e2ec] bg-white text-[#93a2b6] dark:bg-white/5'}`}>{index < current ? <Check className="h-3.5 w-3.5" /> : index + 1}</span>
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
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-[#10203a]/60 p-3 backdrop-blur-sm" onMouseDown={onClose}>
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

interface StyleLibraryModalProps {
  record: SceneGenerationRecord;
  customStyles: EcommerceCustomStyle[];
  mutationError: string;
  onSelectPreset: (id: string | null) => void;
  onSelectCustom: (id: string | null) => void;
  onCreate: (name: string, files: File[]) => Promise<void>;
  onRename: (style: EcommerceCustomStyle) => Promise<void>;
  onDelete: (style: EcommerceCustomStyle) => Promise<void>;
  onClose: () => void;
}

const StyleLibraryModal: React.FC<StyleLibraryModalProps> = ({ record, customStyles, mutationError, onSelectPreset, onSelectCustom, onCreate, onRename, onDelete, onClose }) => {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (!name.trim() || !files.length || saving) return;
    setSaving(true);
    setCreateError('');
    try {
      await onCreate(name.trim(), files);
      setCreating(false);
      setName('');
      setFiles([]);
    } catch (error) {
      setCreateError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SelectionModal title="高级风格库" onClose={onClose}>
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#f0d8c9] bg-[#fff8f3] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-[#17243c]">规则与产品主体优先，风格库负责场景氛围与色调基调</p>
          <p className="mt-1 text-xs leading-5 text-[#718198]">支持选取内置预设，亦可上传1–4张参考图自动提取风格存储在本地。</p>
        </div>
        <button type="button" onClick={() => setCreating((value) => !value)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#ed6d46] px-4 text-xs font-black text-white hover:bg-[#d8552e]">
          <Plus className="h-4 w-4" />创建自定义风格
        </button>
      </div>
      {creating && (
        <div className="mb-6 grid gap-3 rounded-2xl border border-[#d9e5f1] bg-[#f8fbff] p-4 sm:grid-cols-[1fr_1.3fr_auto] sm:items-end">
          <label className="text-xs font-black text-pastel-muted">
            风格名称
            <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-pastel-border bg-white px-3 text-sm text-pastel-text" placeholder="例如：暖阳暖木质调" />
          </label>
          <label className="text-xs font-black text-pastel-muted">
            参考图（1–4张）
            <button type="button" onClick={() => inputRef.current?.click()} className="mt-1 flex min-h-11 w-full items-center justify-center rounded-xl border border-dashed border-[#b9c9dc] bg-white px-3 text-sm font-bold text-[#405773]">
              {files.length ? `已选择 ${files.length} 张` : '点击选择参考图'}
            </button>
            <input ref={inputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => setFiles(Array.from(event.target.files || []).filter((file) => ACCEPTED_MIME_TYPES.has(file.type) && file.size <= MAX_FILE_SIZE).slice(0, MAX_STYLE_IMAGES))} />
          </label>
          <button type="button" onClick={() => void submit()} disabled={!name.trim() || !files.length || saving} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#17243c] px-5 text-xs font-black text-white disabled:opacity-40">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}保存风格
          </button>
          {createError && <p className="text-xs font-bold text-red-600 sm:col-span-3">{createError}</p>}
        </div>
      )}
      {mutationError && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700">{mutationError}</div>}

      <div>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-black">内置电商风格预设</h3><span className="text-xs text-pastel-muted">{ECOMMERCE_STYLE_PRESETS.length} 个预设</span></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {ECOMMERCE_STYLE_PRESETS.map((style) => (
            <button key={style.id} type="button" onClick={() => { onSelectPreset(style.id); onClose(); }} className={`group min-h-44 overflow-hidden rounded-2xl border-2 text-left transition hover:-translate-y-1 ${record.selectedPresetId === style.id ? 'border-[#ed6d46] shadow-[0_10px_24px_rgba(237,109,70,0.18)]' : 'border-transparent bg-pastel-bg'}`}>
              <span className="block h-24" style={{ background: `linear-gradient(135deg, ${style.palette[0]}, ${style.palette[1]} 55%, ${style.palette[2]})` }} />
              <span className="block p-3"><strong className="block text-xs font-black">{style.name}</strong><span className="mt-1 block text-[0.68rem] leading-4 text-pastel-muted">{style.description}</span></span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-7">
        <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-black">我的自定义风格</h3><span className="text-xs text-pastel-muted">保存在本地浏览器</span></div>
        {customStyles.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {customStyles.map((style) => (
              <article key={style.id} className={`group overflow-hidden rounded-2xl border-2 ${record.selectedCustomStyleId === style.id ? 'border-[#ed6d46]' : 'border-pastel-border'}`}>
                <button type="button" onClick={() => { onSelectCustom(style.id); onClose(); }} className="block w-full text-left">
                  <img src={style.thumbnail} alt={style.name} className="h-28 w-full object-cover" />
                  <span className="block p-3 text-xs font-black">{style.name}</span>
                </button>
                <div className="flex border-t border-pastel-border">
                  <button type="button" onClick={() => void onRename(style)} className="min-h-11 flex-1 text-xs font-bold text-pastel-muted hover:text-[#ed6d46]">重命名</button>
                  <button type="button" onClick={() => void onDelete(style)} className="flex min-h-11 w-11 items-center justify-center text-pastel-muted hover:text-red-500" aria-label={`删除${style.name}`}><Trash2 className="h-4 w-4" /></button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="flex min-h-32 items-center justify-center rounded-2xl border border-dashed border-pastel-border bg-pastel-bg text-sm text-pastel-muted">还没有自定义风格</div>
        )}
      </div>

      <button type="button" onClick={() => { onSelectPreset(null); onSelectCustom(null); onClose(); }} className="mt-6 min-h-11 rounded-xl border border-pastel-border px-4 text-xs font-black text-pastel-muted hover:bg-pastel-bg">清除风格选择</button>
    </SelectionModal>
  );
};

const SceneGenerationTab: React.FC<{ isActive?: boolean }> = ({ isActive = true }) => {
  const initialRecordRef = useRef<SceneGenerationRecord | null>(null);
  if (!initialRecordRef.current) initialRecordRef.current = createRecord();

  const [records, setRecords] = useState<SceneGenerationRecord[]>([initialRecordRef.current]);
  const [activeRecordId, setActiveRecordId] = useState(initialRecordRef.current.id);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [isStyleOpen, setIsStyleOpen] = useState(false);
  const [customStyles, setCustomStyles] = useState<EcommerceCustomStyle[]>([]);
  const [styleMutationError, setStyleMutationError] = useState('');
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const [selectionModal, setSelectionModal] = useState<'ratio' | 'board' | null>(null);

  const productInputRef = useRef<HTMLInputElement>(null);
  const refSceneInputRef = useRef<HTMLInputElement>(null);

  const {
    cancelMessage,
    startGenerationTask,
    cancelGenerationTask,
    assertCurrentGenerationTask,
    finishGenerationTask,
  } = useCancelableGeneration();

  const activeRecord = useMemo(() => records.find((record) => record.id === activeRecordId) || records[0], [records, activeRecordId]);
  const isBusy = activeRecord.step === 'analyzing' || activeRecord.step === 'generating';
  const currentBoardConfig = SCENE_BOARD_CONFIGS[activeRecord.boardType];
  const selectedStyle = styleSummary(activeRecord, customStyles);

  useEffect(() => {
    ecommerceStyleLibrary.list().then(setCustomStyles).catch(() => setStyleMutationError('自定义风格库读取失败，本次仍可使用内置预设。'));
  }, []);

  const updateRecord = useCallback((id: string, updater: (record: SceneGenerationRecord) => SceneGenerationRecord) => {
    setRecords((current) => current.map((record) => record.id === id ? updater(record) : record));
  }, []);

  const patchActive = useCallback((patch: Partial<SceneGenerationRecord>) => {
    updateRecord(activeRecordId, (record) => ({ ...record, ...patch }));
  }, [activeRecordId, updateRecord]);

  const patchAnalysis = useCallback((patch: Partial<SceneHeroAnalysis>) => {
    updateRecord(activeRecordId, (record) => record.analysis ? { ...record, analysis: { ...record.analysis, ...patch } } : record);
  }, [activeRecordId, updateRecord]);

  const processProductFiles = useCallback(async (files: File[]) => {
    if (isBusy) return;
    try {
      const { uploaded, imageFiles, accepted } = await readUploadedFiles(files, MAX_PRODUCT_IMAGES, activeRecord.productImages.length);
      if (!uploaded.length) {
        const message = imageFiles.some((file) => file.size > MAX_FILE_SIZE) ? '单张图片不能超过5MB。' : imageFiles.length ? '最多上传10张产品图。' : '仅支持JPG、JPEG、PNG或WEBP格式。';
        patchActive({ error: message });
        return;
      }
      updateRecord(activeRecord.id, (record) => ({
        ...record,
        productImages: [...record.productImages, ...uploaded].slice(0, MAX_PRODUCT_IMAGES),
        analysis: null,
        results: [],
        step: 'input',
        error: imageFiles.length > accepted.length ? '部分图片未加入：最多10张且单张不超过5MB。' : '',
      }));
    } catch (error) {
      patchActive({ error: getErrorMessage(error) });
    }
  }, [activeRecord.id, activeRecord.productImages.length, isBusy, patchActive, updateRecord]);

  const processRefSceneFile = useCallback(async (file: File) => {
    if (isBusy || !ACCEPTED_MIME_TYPES.has(file.type) || file.size > MAX_FILE_SIZE) return;
    try {
      const compressed = await compressImage(file, 2048, 0.92);
      const uploaded: SceneUploadedImage = {
        id: crypto.randomUUID(),
        name: file.name,
        mime: compressed.mime,
        base64: compressed.base64,
        preview: `data:${compressed.mime};base64,${compressed.base64}`,
      };
      patchActive({ referenceSceneImage: uploaded, analysis: null, results: [], step: 'input', error: '' });
    } catch (error) {
      patchActive({ error: getErrorMessage(error) });
    }
  }, [isBusy, patchActive]);

  useImagePaste((files) => {
    if (!files.length || isBusy || activeRecord.step !== 'input' || isStyleOpen) return;
    void processProductFiles(files);
  }, isActive && !isBusy && activeRecord.step === 'input' && !isStyleOpen);

  const removeProductImage = (id: string) => updateRecord(activeRecord.id, (record) => ({ ...record, productImages: record.productImages.filter((image) => image.id !== id), analysis: null, results: [], error: '' }));
  const removeRefSceneImage = () => patchActive({ referenceSceneImage: null, analysis: null, results: [], error: '' });

  const startNewRecord = () => {
    if (isBusy) return;
    const record = createRecord();
    setRecords((current) => [record, ...current].slice(0, MAX_RECORDS));
    setActiveRecordId(record.id);
  };

  const deleteRecord = (id: string) => {
    if (isBusy && id === activeRecord.id) return;
    if (records.length === 1) {
      const replacement = createRecord();
      setRecords([replacement]);
      setActiveRecordId(replacement.id);
      return;
    }
    const next = records.filter((record) => record.id !== id);
    setRecords(next);
    if (id === activeRecord.id) setActiveRecordId(next[0].id);
  };

  const createCustomStyle = async (name: string, files: File[]) => {
    setStyleMutationError('');
    const { uploaded } = await readUploadedFiles(files, MAX_STYLE_IMAGES, 0);
    if (!uploaded.length) throw new Error('请上传1–4张有效参考图。');
    const text = await generateText(uploaded.map(toApiImage), `
You are an expert commercial visual style analyst. Analyze these images ONLY for style, lighting, composition and lifestyle mood.
Return ONLY JSON:
{"palette":"","lighting":"","background":"","composition":"","propDensity":"","typographyDensity":"","forbiddenElements":[""],"promptBlock":"concise style prompt, no copied products"}
`.trim(), 'gemini-3.1-flash-lite-preview');
    const analysis = parseStyleAnalysis(text);
    const now = Date.now();
    const style: EcommerceCustomStyle = { id: crypto.randomUUID(), name, createdAt: now, updatedAt: now, thumbnail: uploaded[0].preview, referenceImages: uploaded.map((item) => item.preview), analysis };
    setCustomStyles((current) => [style, ...current]);
    patchActive({ selectedCustomStyleId: style.id, selectedPresetId: null });
    try {
      await ecommerceStyleLibrary.save(style);
    } catch {
      setStyleMutationError('存储写入受限：该风格本次会话可用。');
    }
  };

  const renameCustomStyle = async (style: EcommerceCustomStyle) => {
    const name = window.prompt('输入新的风格名称', style.name)?.trim();
    if (!name || name === style.name) return;
    const next = { ...style, name, updatedAt: Date.now() };
    setCustomStyles((current) => current.map((item) => item.id === style.id ? next : item));
    try { await ecommerceStyleLibrary.save(next); } catch { setStyleMutationError('重命名未能同步写入。'); }
  };

  const deleteCustomStyle = async (style: EcommerceCustomStyle) => {
    setCustomStyles((current) => current.filter((item) => item.id !== style.id));
    if (activeRecord.selectedCustomStyleId === style.id) patchActive({ selectedCustomStyleId: null });
    try { await ecommerceStyleLibrary.remove(style.id); } catch { setStyleMutationError('删除操作未能同步到存储。'); }
  };

  const updateResult = useCallback((recordId: string, resultId: string, patch: Partial<SceneHeroResult>) => {
    updateRecord(recordId, (record) => ({ ...record, results: record.results.map((result) => result.id === resultId ? { ...result, ...patch } : result) }));
  }, [updateRecord]);

  const generateOne = async (record: SceneGenerationRecord, result: SceneHeroResult, index: number, signal: AbortSignal) => {
    if (!record.analysis) throw new Error('缺少可用的 Agent 规划方案。');
    const style = styleSummary(record, customStyles);
    const prompt = buildGenerationPrompt(record, record.analysis, index, style.name, style.prompt, style.references.length);
    updateResult(record.id, result.id, { status: 'submitting', prompt, error: undefined });

    const inputImages = [...record.productImages.map(toApiImage)];
    if (record.referenceSceneImage) inputImages.push(toApiImage(record.referenceSceneImage));
    style.references.forEach((ref) => inputImages.push(toApiImage(ref)));

    const [rawImage] = await generateImageToImage(
      inputImages,
      prompt,
      {
        aspectRatio: record.aspectRatio,
        resolution: record.resolution,
        modelId: record.modelId,
        workflowHint: 'scene-product-lock',
        signal,
        onStatus: (status) => updateResult(record.id, result.id, { status: status === 'submitting' ? 'submitting' : 'processing' }),
      },
    );
    if (!rawImage) throw new Error('模型未返回生成场景图。');
    return { ...result, status: 'done' as const, prompt, imageUrl: rawImage };
  };

  const saveRecord = async (record: SceneGenerationRecord, results: SceneHeroResult[]) => {
    const successful = results.filter((result) => result.status === 'done' && result.imageUrl);
    if (!successful.length) return;
    await saveGeneratedProject({
      type: 'MARKETING',
      generated: successful.map((result) => result.imageUrl!),
      original: [...record.productImages.map(toDataUrl), ...(record.referenceSceneImage ? [toDataUrl(record.referenceSceneImage)] : [])],
      prompt: successful[0].prompt,
      thumbnail: successful[0].imageUrl,
      params: {
        source: 'Cyzx4/components/SceneGenerationTab',
        subType: 'scene_generation_batch',
        model: record.modelId,
        boardType: record.boardType,
        aspectRatio: record.aspectRatio,
        resolution: record.resolution,
        outputCount: results.length,
        productImageCount: record.productImages.length,
        mode: record.mode,
        userHint: record.userHint,
        productSize: record.productSize,
        analysis: record.analysis,
      },
    });
  };

  const runGeneration = async (sourceRecord: SceneGenerationRecord) => {
    if (!sourceRecord.analysis) return;
    const generationStyle = styleSummary(sourceRecord, customStyles);
    const initialResults: SceneHeroResult[] = Array.from({ length: sourceRecord.outputCount }, () => ({ id: crypto.randomUUID(), status: 'pending', prompt: '' }));
    const snapshot: SceneGenerationRecord = { ...sourceRecord, productImages: [...sourceRecord.productImages], results: initialResults, step: 'generating', error: '' };
    const { taskId, signal } = startGenerationTask();
    updateRecord(snapshot.id, () => snapshot);
    try {
      const settled = await Promise.allSettled(initialResults.map((result, index) => generateOne(snapshot, result, index, signal).catch((error) => {
        updateResult(snapshot.id, result.id, { status: isAbortError(error) ? 'cancelled' : 'error', error: isAbortError(error) ? '任务已取消' : getErrorMessage(error) });
        throw error;
      })));
      assertCurrentGenerationTask(taskId, signal);
      const finalResults = settled.map((outcome, index): SceneHeroResult => outcome.status === 'fulfilled'
        ? outcome.value
        : { ...initialResults[index], status: isAbortError(outcome.reason) ? 'cancelled' : 'error', prompt: buildGenerationPrompt(snapshot, snapshot.analysis!, index, generationStyle.name, generationStyle.prompt, generationStyle.references.length), error: isAbortError(outcome.reason) ? '任务已取消' : getErrorMessage(outcome.reason) });
      updateRecord(snapshot.id, (record) => ({ ...record, step: 'complete', results: finalResults, error: finalResults.every((result) => result.status !== 'done') ? '本次任务未生成成功，可尝试重试。' : '' }));
      await saveRecord(snapshot, finalResults);
    } catch (error) {
      if (!isAbortError(error)) updateRecord(snapshot.id, (record) => ({ ...record, step: 'complete', error: getErrorMessage(error) }));
    } finally {
      finishGenerationTask(taskId);
    }
  };

  const handleAnalyze = async () => {
    if (!activeRecord.productImages.length || isBusy) {
      if (!activeRecord.productImages.length) patchActive({ error: '请至少上传1张产品图。' });
      return;
    }
    const snapshot: SceneGenerationRecord = { ...activeRecord, productImages: [...activeRecord.productImages], results: [], analysis: null, error: '' };
    const analysisStyle = styleSummary(snapshot, customStyles);
    const { taskId, signal } = startGenerationTask();
    updateRecord(snapshot.id, (record) => ({ ...record, step: 'analyzing', analysis: null, results: [], error: '', createdAt: Date.now() }));
    try {
      const apiImages = [...snapshot.productImages.map(toApiImage)];
      if (snapshot.referenceSceneImage) apiImages.push(toApiImage(snapshot.referenceSceneImage));

      const text = await generateText(apiImages, buildAnalysisPrompt(snapshot, analysisStyle.name, analysisStyle.prompt), 'gemini-3.1-flash-lite-preview');
      assertCurrentGenerationTask(taskId, signal);
      const analysis = parseSceneAnalysis(text, snapshot.outputCount, snapshot.boardType, snapshot.productSize);
      const resolved: SceneGenerationRecord = {
        ...snapshot,
        analysis,
        boardType: analysis.recommendedBoard || snapshot.boardType,
        aspectRatio: SCENE_BOARD_CONFIGS[analysis.recommendedBoard || snapshot.boardType].aspectRatio,
        step: snapshot.oneClick ? 'generating' : 'confirm',
        error: '',
      };
      updateRecord(snapshot.id, () => resolved);
      finishGenerationTask(taskId);
      if (snapshot.oneClick) await runGeneration(resolved);
    } catch (error) {
      if (!isAbortError(error)) updateRecord(snapshot.id, (record) => ({ ...record, step: 'input', error: getErrorMessage(error) }));
      finishGenerationTask(taskId);
    }
  };

  const handleCancel = () => {
    cancelGenerationTask('已停止生成场景图任务');
    updateRecord(activeRecord.id, (record) => ({ ...record, step: record.step === 'analyzing' ? 'input' : 'complete', results: record.results.map((result) => isWorkingStatus(result.status) ? { ...result, status: 'cancelled', error: '任务已取消' } : result) }));
  };

  const retryOne = async (resultId: string) => {
    if (!activeRecord.analysis || isBusy) return;
    const index = activeRecord.results.findIndex((result) => result.id === resultId);
    if (index < 0) return;
    const target = { ...activeRecord.results[index], status: 'pending' as const, error: undefined };
    const snapshot: SceneGenerationRecord = { ...activeRecord, results: activeRecord.results.map((result) => result.id === resultId ? target : result), step: 'generating', error: '' };
    const { taskId, signal } = startGenerationTask();
    updateRecord(snapshot.id, () => snapshot);
    try {
      const completed = await generateOne(snapshot, target, index, signal);
      assertCurrentGenerationTask(taskId, signal);
      const results = snapshot.results.map((result) => result.id === resultId ? completed : result);
      updateRecord(snapshot.id, (record) => ({ ...record, step: 'complete', results }));
      await saveRecord(snapshot, results);
    } catch (error) {
      updateRecord(snapshot.id, (record) => ({ ...record, step: 'complete', results: record.results.map((result) => result.id === resultId ? { ...result, status: isAbortError(error) ? 'cancelled' : 'error', error: isAbortError(error) ? '任务已取消' : getErrorMessage(error) } : result) }));
    } finally {
      finishGenerationTask(taskId);
    }
  };

  const downloadImage = (src: string, index: number) => {
    const link = document.createElement('a');
    link.href = src;
    link.download = `生成场景图-${activeRecord.boardType}-${index + 1}-${Date.now()}.png`;
    link.click();
  };

  const completedCount = activeRecord.results.filter((result) => result.status === 'done').length;
  const successfulResults = activeRecord.results.filter((result) => result.status === 'done' && result.imageUrl);
  const selectedImageModel = IMAGE_MODEL_OPTIONS.find((m) => m.id === activeRecord.modelId) || IMAGE_MODEL_OPTIONS[0];

  const historyPanel = (
    <aside className="flex h-full flex-col rounded-2xl border border-[#d8e3ee] bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#11151c]">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-base font-black">生成记录</h2>
          <p className="mt-0.5 text-xs text-pastel-muted">当前会话最多20项</p>
        </div>
        <button type="button" onClick={() => setIsHistoryOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-pastel-border text-pastel-muted" aria-label="收起生成记录"><PanelLeftClose className="h-4 w-4" /></button>
      </div>
      <button type="button" onClick={startNewRecord} disabled={isBusy} className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#17243c] text-sm font-black text-white disabled:opacity-40"><Plus className="h-4 w-4" />新开任务</button>
      <div className="mt-3 flex-1 space-y-2 overflow-y-auto">{records.map((record) => <button key={record.id} type="button" onClick={() => setActiveRecordId(record.id)} className={`group relative w-full overflow-hidden rounded-xl border p-3 text-left transition ${record.id === activeRecord.id ? 'border-[#ed6d46] bg-[#fff8f3]' : 'border-pastel-border bg-pastel-bg/40 hover:border-[#efb49d]'}`}><div className="flex items-start justify-between gap-2"><span className="truncate text-xs font-black">{record.analysis?.productName || '未命名产品'}</span><span className="shrink-0 rounded-full bg-white px-2 py-1 text-[0.62rem] font-bold text-pastel-muted">{STEPS.find((item) => item.id === record.step)?.label}</span></div><div className="mt-2 flex items-center justify-between text-[0.68rem] text-pastel-muted"><span>{SCENE_BOARD_CONFIGS[record.boardType].label} · {record.outputCount}张</span><span>{new Date(record.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div><span role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); deleteRecord(record.id); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.stopPropagation(); deleteRecord(record.id); } }} className="absolute bottom-2 right-2 hidden h-8 w-8 items-center justify-center rounded-lg bg-white text-red-400 shadow group-hover:flex" aria-label="删除记录"><Trash2 className="h-3.5 w-3.5" /></span></button>)}</div>
    </aside>
  );

  const inputPanel = activeRecord.step === 'input' || activeRecord.step === 'analyzing' ? (
    <div className="flex min-w-0 flex-col gap-4">
      {/* Model Selection */}
      <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-black">生成模型</h2>
            <p className="mt-1 text-xs leading-5 text-pastel-muted">默认使用Gemini Banana 2，也可切换GPT Image 2或Gemini 3 Pro。</p>
          </div>
          <span className="rounded-full bg-[#fff0e8] px-2.5 py-1 text-[0.65rem] font-black text-[#d8552e]">{selectedImageModel.badge}</span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {IMAGE_MODEL_OPTIONS.map((model) => {
            const selected = activeRecord.modelId === model.id;
            return (
              <button key={model.id} type="button" disabled={isBusy} onClick={() => patchActive({ modelId: model.id, results: [] })} className={`relative flex min-h-20 items-center gap-2.5 rounded-xl border p-2.5 text-left transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${selected ? 'border-[#ed6d46] bg-gradient-to-br from-[#fff7f2] to-[#eef5ff] shadow-[0_8px_20px_rgba(237,109,70,0.12)]' : 'border-pastel-border bg-pastel-bg/60 hover:border-[#efb49d]'}`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${model.id === 'gpt-image-2' ? 'bg-[#17243c] text-white' : 'bg-[#e8f2ff] text-[#2d6bb1]'}`}><Sparkles className="h-4 w-4" /></span>
                <span className="min-w-0 pr-3"><strong className="block text-xs font-black leading-snug text-[#17243c]">{model.label}</strong><small className="mt-0.5 block text-[0.68rem] text-pastel-muted">{model.description}</small></span>
                {selected && <CheckCircle2 className="absolute right-2 top-2 h-4 w-4 shrink-0 text-[#ed6d46]" />}
              </button>
            );
          })}
        </div>
      </section>

      {/* Mode Selection */}
      <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c] sm:p-5">
        <div>
          <h2 className="text-base font-black">填写信息</h2>
          <p className="mt-1 text-xs text-pastel-muted">普通模式快速生成，高级模式可注入风格。</p>
        </div>
        <div className="mt-4 grid grid-cols-2 rounded-xl bg-pastel-bg p-1">
          <button type="button" disabled={isBusy} onClick={() => patchActive({ mode: 'standard', selectedPresetId: null, selectedCustomStyleId: null })} className={`min-h-11 rounded-lg text-xs font-black ${activeRecord.mode === 'standard' ? 'bg-white text-[#17243c] shadow-sm' : 'text-pastel-muted'}`}>普通模式</button>
          <button type="button" disabled={isBusy} onClick={() => patchActive({ mode: 'advanced' })} className={`min-h-11 rounded-lg text-xs font-black ${activeRecord.mode === 'advanced' ? 'bg-white text-[#17243c] shadow-sm' : 'text-pastel-muted'}`}>高级模式</button>
        </div>
      </section>

      {/* Upload Product Images */}
      <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf3ff] text-[#2d6bb1]"><ImageIcon className="h-5 w-5" /></span>
            <div>
              <h3 className="text-sm font-black">产品图</h3>
              <p className="mt-1 text-xs leading-5 text-pastel-muted">同一款商品的多角度与规格细节，第一张为主身份。</p>
            </div>
          </div>
          <span className="text-xs font-bold text-pastel-muted">{activeRecord.productImages.length}/{MAX_PRODUCT_IMAGES}</span>
        </div>
        {activeRecord.productImages.length > 0 && (
          <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-5">
            {activeRecord.productImages.map((image, index) => (
              <div key={image.id} className="group relative aspect-square overflow-hidden rounded-xl border border-pastel-border bg-pastel-bg">
                <img src={image.preview} alt={image.name} className="h-full w-full object-cover" />
                {index === 0 && <span className="absolute bottom-1 left-1 rounded bg-[#17243c] px-1.5 py-1 text-[0.55rem] font-black text-white">主身份</span>}
                <button type="button" disabled={isBusy} onClick={() => removeProductImage(image.id)} className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#17243c]/85 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100" aria-label={`删除${image.name}`}><X className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
        {activeRecord.productImages.length < MAX_PRODUCT_IMAGES && (
          <button type="button" disabled={isBusy} onClick={() => productInputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void processProductFiles(Array.from(event.dataTransfer.files)); }} className="mt-4 flex min-h-32 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cbd8e8] bg-[#f8fbff] px-4 text-center hover:border-[#ed6d46] disabled:opacity-50">
            <Upload className="h-6 w-6 text-[#ed6d46]" />
            <span className="mt-2 text-sm font-black">拖拽、点击或Ctrl+V粘贴图片</span>
            <span className="mt-1 text-xs text-pastel-muted">JPG / JPEG / PNG / WEBP · 单张≤5MB</span>
          </button>
        )}
        <input ref={productInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { void processProductFiles(Array.from(event.target.files || [])); event.target.value = ''; }} />
      </section>

      {/* Upload Reference Scene Image (Optional) */}
      <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff0e8] text-[#ed6d46]">
              <ImageIcon className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-black">参考场景图 (可选)</h3>
              <p className="mt-1 text-xs leading-5 text-pastel-muted">自动分析并同步构图、姿势动作与光影方案</p>
            </div>
          </div>
          {activeRecord.referenceSceneImage && (
            <button
              type="button"
              disabled={isBusy}
              onClick={removeRefSceneImage}
              className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600 hover:bg-red-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
              移除参考图
            </button>
          )}
        </div>

        {activeRecord.referenceSceneImage ? (
          <div className="group relative mt-4 aspect-video overflow-hidden rounded-xl border border-pastel-border bg-pastel-bg sm:h-44 sm:w-auto">
            <img src={activeRecord.referenceSceneImage.preview} alt="参考场景图" className="h-full w-full object-cover" />
            <span className="absolute bottom-2 left-2 rounded-lg bg-[#17243c]/90 px-2 py-1 text-xs font-black text-white backdrop-blur-sm">
              按此场景与动作复刻
            </span>
            <button
              type="button"
              disabled={isBusy}
              onClick={removeRefSceneImage}
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#17243c]/85 text-white shadow"
              aria-label="移除参考图"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => refSceneInputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files?.[0];
              if (file) void processRefSceneFile(file);
            }}
            className="mt-4 flex min-h-28 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cbd8e8] bg-[#f8fbff] px-4 text-center hover:border-[#ed6d46] disabled:opacity-50"
          >
            <WandSparkles className="h-6 w-6 text-[#ed6d46]" />
            <span className="mt-2 text-sm font-black text-[#17243c]">上传参考图</span>
            <span className="mt-1 text-xs text-pastel-muted">自动分析并同步构图与光影方案</span>
          </button>
        )}
        <input
          ref={refSceneInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void processRefSceneFile(file);
            event.target.value = '';
          }}
        />
      </section>

      {/* Style Library Entry - Advanced Mode Only */}
      {activeRecord.mode === 'advanced' && (
        <button type="button" onClick={() => setIsStyleOpen(true)} className="flex min-h-20 items-center justify-between rounded-2xl border border-[#efd9c9] bg-gradient-to-r from-[#fff8f2] to-white px-4 text-left shadow-sm">
          <span className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#ffd18f] via-[#e8d7a6] to-[#b9e8dd]"><WandSparkles className="h-5 w-5 text-[#8a4b2f]" /></span>
            <span><strong className="block text-sm font-black">风格库</strong><small className="mt-1 block text-xs text-pastel-muted">{selectedStyle.name}</small></span>
          </span>
          <ChevronRight className="h-5 w-5 text-pastel-muted" />
        </button>
      )}

      {/* Scene Board & Parameters Section */}
      <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c] sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => setSelectionModal('board')}
            className="flex min-h-16 flex-col justify-center rounded-xl border border-pastel-border bg-pastel-bg p-3 text-left transition hover:border-[#ed6d46]"
          >
            <span className="text-[0.68rem] font-bold text-pastel-muted">场景板块</span>
            <div className="mt-1 flex items-center justify-between">
              <strong className="flex items-center gap-1.5 text-sm font-black text-pastel-text">
                <span className="text-base">{SCENE_BOARD_CONFIGS[activeRecord.boardType].icon}</span>
                <span>{SCENE_BOARD_CONFIGS[activeRecord.boardType].label}</span>
              </strong>
              <ChevronRight className="h-4 w-4 text-pastel-muted" />
            </div>
          </button>
          <div className="min-h-16 rounded-xl border border-pastel-border bg-pastel-bg p-3 text-left">
            <span className="text-[0.68rem] font-bold text-pastel-muted">产品实际尺寸</span>
            <input value={activeRecord.productSize} onChange={(event) => patchActive({ productSize: event.target.value })} disabled={isBusy} className="mt-1 w-full bg-transparent text-sm font-black text-pastel-text outline-none" placeholder="如 35cm / 20x15cm" />
          </div>
        </div>

        <label className="mt-4 block text-xs font-black text-pastel-muted">
          一句话描述场景与卖点（选填）
          <textarea value={activeRecord.userHint} disabled={isBusy} onChange={(event) => patchActive({ userHint: event.target.value, analysis: null, results: [] })} className="mt-1 min-h-24 w-full resize-y rounded-xl border border-pastel-border bg-pastel-bg px-3 py-3 text-sm leading-6 text-pastel-text outline-none focus:border-[#ed6d46]" placeholder="例如：圣诞送礼场景、亲子温馨陪伴、卧室床头柔光..." />
        </label>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button type="button" disabled={isBusy} onClick={() => setSelectionModal('ratio')} className="flex min-h-16 flex-col justify-center rounded-xl border border-pastel-border bg-pastel-bg p-3 text-left transition hover:border-[#ed6d46]">
            <span className="text-[0.68rem] font-bold text-pastel-muted">尺寸比例</span>
            <div className="mt-1 flex items-center justify-between">
              <strong className="text-sm font-black text-pastel-text">{ECOMMERCE_RATIOS.find((r) => r.id === activeRecord.aspectRatio)?.label || activeRecord.aspectRatio}</strong>
              <ChevronRight className="h-4 w-4 text-pastel-muted" />
            </div>
          </button>
          <div className="min-h-16 rounded-xl border border-pastel-border bg-pastel-bg p-3 text-left">
            <span className="text-[0.68rem] font-bold text-pastel-muted">分辨率</span>
            <select value={activeRecord.resolution} disabled={isBusy} onChange={(event) => patchActive({ resolution: event.target.value as ImageResolution })} className="mt-1 min-h-8 w-full bg-transparent text-sm font-black text-pastel-text outline-none">
              <option value={ImageResolution.RES_1K}>1K</option>
              <option value={ImageResolution.RES_2K}>2K（默认）</option>
              <option value={ImageResolution.RES_4K}>4K</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <span className="text-xs font-black text-pastel-muted">生成数量</span>
          <div className="mt-2 grid grid-cols-6 gap-2">
            {[1, 2, 3, 4, 5, 6].map((count) => (
              <button key={count} type="button" disabled={isBusy} onClick={() => patchActive({ outputCount: count })} className={`min-h-11 rounded-xl border text-sm font-black ${activeRecord.outputCount === count ? 'border-[#ed6d46] bg-[#fff2eb] text-[#d8552e]' : 'border-pastel-border bg-white text-pastel-muted'}`}>{count}</button>
            ))}
          </div>
        </div>
      </section>

      {/* One click toggle */}
      <label className="flex min-h-16 cursor-pointer items-center justify-between rounded-2xl border border-pastel-border bg-white px-4 shadow-sm">
        <span><strong className="block text-sm font-black">一键生图</strong><small className="mt-1 block text-xs text-pastel-muted">分析成功后跳过确认并自动生成</small></span>
        <span className={`relative h-7 w-12 rounded-full transition ${activeRecord.oneClick ? 'bg-[#ed6d46]' : 'bg-[#d8e2ec]'}`}>
          <input type="checkbox" checked={activeRecord.oneClick} disabled={isBusy} onChange={(event) => patchActive({ oneClick: event.target.checked })} className="sr-only" />
          <i className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${activeRecord.oneClick ? 'left-6' : 'left-1'}`} />
        </span>
      </label>

      {/* Action Submit Button */}
      <button type="button" onClick={() => void handleAnalyze()} disabled={!activeRecord.productImages.length || isBusy} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#17243c] text-sm font-black text-white shadow-[0_14px_28px_rgba(23,36,60,0.18)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none">
        {activeRecord.step === 'analyzing' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5 text-[#ff9b67]" />}
        {activeRecord.step === 'analyzing' ? 'Agent正在分析场景与人群…' : '分析产品，生成场景图方案'}
      </button>
      {activeRecord.step === 'analyzing' && <button type="button" onClick={handleCancel} className="min-h-11 rounded-xl border border-pastel-border text-xs font-black text-pastel-muted">取消分析</button>}
    </div>
  ) : (
    /* CONFIRMED INPUT Panel for Step 3 (Confirm), Step 4 (Generating), Step 5 (Complete) - Matches 图6 */
    <div className="flex min-w-0 flex-col gap-4">
      <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text-[0.68rem] font-black tracking-[0.14em] text-[#ed6d46]">CONFIRMED INPUT</span>
            <h2 className="mt-1 text-lg font-black">{activeRecord.analysis?.productName || '生成场景图'}</h2>
          </div>
          {!isBusy && (
            <button type="button" onClick={() => patchActive({ step: 'input', results: [], error: '' })} className="flex min-h-11 items-center gap-2 rounded-xl border border-pastel-border px-3 text-xs font-black text-pastel-muted hover:bg-pastel-bg">
              <ArrowLeft className="h-4 w-4" />修改输入
            </button>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl bg-pastel-bg p-3"><span className="text-pastel-muted">场景板块</span><strong className="mt-1 block">{SCENE_BOARD_CONFIGS[activeRecord.boardType].label}</strong></div>
          <div className="rounded-xl bg-pastel-bg p-3"><span className="text-pastel-muted">产品尺寸</span><strong className="mt-1 block">{activeRecord.productSize || '未指定比例'}</strong></div>
          <div className="rounded-xl bg-pastel-bg p-3"><span className="text-pastel-muted">比例</span><strong className="mt-1 block">{activeRecord.aspectRatio}</strong></div>
          <div className="rounded-xl bg-pastel-bg p-3"><span className="text-pastel-muted">输出</span><strong className="mt-1 block">{activeRecord.outputCount}张 · {activeRecord.resolution}</strong></div>
        </div>
      </section>
      {cancelMessage && <p className="text-center text-xs font-bold text-[#d8552e]">{cancelMessage}</p>}
    </div>
  );

  const confirmationControls = activeRecord.analysis && activeRecord.step === 'confirm' ? (
    <section className="rounded-2xl border border-[#f0d8c9] bg-[#fffaf6] p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-[#17243c]">确认输出参数</h3>
          <p className="mt-1 text-xs leading-5 text-pastel-muted">可在线微调画幅比例和生成数量，修改后按最新方案生成。</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#d8552e]">{selectedImageModel.label} · {activeRecord.resolution}</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-black text-pastel-muted">
          尺寸比例
          <select value={activeRecord.aspectRatio} onChange={(event) => patchActive({ aspectRatio: event.target.value as AspectRatio })} className="mt-1 min-h-12 w-full rounded-xl border border-pastel-border bg-white px-3 text-sm font-black text-pastel-text">
            <option value={AspectRatio.SQUARE}>1:1 正方形</option>
            <option value={AspectRatio.LANDSCAPE_16_9}>16:9 横屏</option>
            <option value={AspectRatio.PORTRAIT_3_4}>3:4 竖屏</option>
            <option value={AspectRatio.PORTRAIT_2_3}>2:3 竖屏</option>
            <option value={AspectRatio.PORTRAIT_9_16}>9:16 手机比例</option>
            <option value={AspectRatio.LANDSCAPE_21_9}>21:9 超宽屏</option>
          </select>
        </label>
        <div>
          <span className="text-xs font-black text-pastel-muted">生成数量</span>
          <div className="mt-1 grid grid-cols-6 gap-1.5">
            {[1, 2, 3, 4, 5, 6].map((count) => (
              <button key={count} type="button" onClick={() => {
                const imagePlans = [...activeRecord.analysis!.imagePlans];
                while (imagePlans.length < count) imagePlans.push(`生成第 ${imagePlans.length + 1} 张高转化场景视觉，保持商品特征并使用差异化构图。`);
                patchActive({ outputCount: count });
                patchAnalysis({ imagePlans: imagePlans.slice(0, count) });
              }} className={`min-h-12 rounded-xl border text-xs font-black ${activeRecord.outputCount === count ? 'border-[#ed6d46] bg-[#fff0e8] text-[#d8552e]' : 'border-pastel-border bg-white text-pastel-muted'}`}>{count}</button>
            ))}
          </div>
        </div>
      </div>
    </section>
  ) : null;

  const confirmPanel = activeRecord.analysis && activeRecord.step === 'confirm' ? (
    <>
      {confirmationControls}
      <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c] sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-5 w-5" /></span>
          <div><span className="text-[0.68rem] font-black tracking-[0.14em] text-emerald-600">ANALYSIS READY</span><h2 className="mt-0.5 text-xl font-black">确认生成场景图方案</h2></div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-black text-pastel-muted">产品名称<input value={activeRecord.analysis.productName} onChange={(event) => patchAnalysis({ productName: event.target.value })} className="mt-1 min-h-12 w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-sm text-pastel-text" /></label>
          <label className="text-xs font-black text-pastel-muted">产品品类<input value={activeRecord.analysis.productCategory} onChange={(event) => patchAnalysis({ productCategory: event.target.value })} className="mt-1 min-h-12 w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-sm text-pastel-text" /></label>
          <div className="rounded-xl bg-pastel-bg p-4 sm:col-span-2"><span className="text-xs font-black text-pastel-muted">产品身份摘要（只读）</span><p className="mt-2 text-sm leading-6">{activeRecord.analysis.productIdentity}</p></div>
          <label className="text-xs font-black text-pastel-muted sm:col-span-2">核心卖点（每行一条）<textarea value={activeRecord.analysis.sellingPoints.join('\n')} onChange={(event) => patchAnalysis({ sellingPoints: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean).slice(0, 6) })} className="mt-1 min-h-24 w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 py-3 text-sm leading-6 text-pastel-text" /></label>
        </div>

        <div className="mt-4 rounded-xl border border-[#dbe7f3] bg-[#f5f9fd] p-4">
          <div className="flex items-center gap-2 text-xs font-black text-[#2d6bb1]"><Brain className="h-4 w-4" />场景 Agent 建议</div>
          <p className="mt-2 text-sm leading-6">{activeRecord.analysis.boardReason}</p>
          <p className="mt-2 text-xs leading-5 text-pastel-muted">{activeRecord.analysis.boardVisualStrategy}</p>
        </div>

        <div className="mt-5">
          <span className="text-xs font-black text-pastel-muted">单图规划推演（可直接修改描述）</span>
          <div className="mt-2 space-y-2">
            {activeRecord.analysis.imagePlans.map((plan, index) => (
              <label key={index} className="flex gap-3 rounded-xl border border-pastel-border bg-pastel-bg p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-black text-[#ed6d46]">{index + 1}</span>
                <textarea value={plan} onChange={(event) => patchAnalysis({ imagePlans: activeRecord.analysis!.imagePlans.map((item, itemIndex) => itemIndex === index ? event.target.value : item) })} className="min-h-16 flex-1 resize-y bg-transparent text-xs leading-5 text-pastel-text outline-none" />
              </label>
            ))}
          </div>
        </div>

        {activeRecord.analysis.riskWarnings.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
            <strong className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />生成前注意</strong>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {activeRecord.analysis.riskWarnings.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <button type="button" onClick={() => patchActive({ step: 'input', error: '' })} className="min-h-12 rounded-xl border border-pastel-border px-5 text-sm font-black text-pastel-muted">返回修改输入</button>
          <button type="button" onClick={() => void runGeneration(activeRecord)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#17243c] px-6 text-sm font-black text-white"><Sparkles className="h-4 w-4 text-[#ff9b67]" />确认方案，生成{activeRecord.outputCount}张</button>
        </div>
      </section>
    </>
  ) : null;

  const resultPanel = activeRecord.step === 'generating' || activeRecord.step === 'complete' ? (
    <section className="flex min-h-[34rem] flex-col rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c] sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5 text-[#ed6d46]" />
            <h2 className="text-lg font-black">生成场景图结果</h2>
            <span className="text-xs font-bold text-pastel-muted">{completedCount}/{activeRecord.results.length}</span>
          </div>
          <p className="mt-1 text-xs text-pastel-muted">根据场景氛围规划生成高转化视觉照片。</p>
        </div>
        <div className="flex gap-2">
          {activeRecord.step === 'generating' && <button type="button" onClick={handleCancel} className="min-h-11 rounded-xl bg-[#17243c] px-4 text-xs font-black text-white">停止全部</button>}
          {successfulResults.length > 0 && activeRecord.step === 'complete' && <button type="button" onClick={() => successfulResults.forEach((result, index) => result.imageUrl && window.setTimeout(() => downloadImage(result.imageUrl!, index), index * 140))} className="flex min-h-11 items-center gap-2 rounded-xl bg-[#ed6d46] px-4 text-xs font-black text-white"><Download className="h-4 w-4" />全部下载</button>}
        </div>
      </div>

      <div className="grid grid-cols-1 content-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {activeRecord.results.map((result, index) => (
          <article key={result.id} className="overflow-hidden rounded-2xl border border-pastel-border bg-white shadow-sm">
            <div className="relative flex min-h-56 aspect-square items-center justify-center overflow-hidden bg-[#edf3f8]">
              {result.imageUrl ? (
                <img src={result.imageUrl} alt={`生成场景图结果${index + 1}`} className="h-full w-full object-contain cursor-zoom-in" onClick={() => setSelectedPreview(result.imageUrl!)} />
              ) : isWorkingStatus(result.status) ? (
                <div className="flex flex-col items-center gap-3 p-6 text-center text-[#ed6d46]">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="text-sm font-black">生成渲染中...</span>
                </div>
              ) : (
                <div className="max-w-xs p-6 text-center">
                  <AlertCircle className="mx-auto h-7 w-7 text-red-400" />
                  <p className="mt-3 text-sm font-bold text-red-600">{result.error || '生成失败'}</p>
                </div>
              )}
            </div>
            <div className="flex min-h-16 items-center justify-between gap-2 border-t border-pastel-border px-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-black">场景方案 {index + 1}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                {result.imageUrl && <button type="button" onClick={() => setSelectedPreview(result.imageUrl!)} className="flex h-11 w-11 items-center justify-center rounded-lg text-pastel-muted hover:bg-pastel-bg hover:text-[#2d6bb1]" aria-label="放大预览"><Maximize2 className="h-4 w-4" /></button>}
                <button type="button" onClick={() => void retryOne(result.id)} disabled={activeRecord.step === 'generating'} className="flex h-11 w-11 items-center justify-center rounded-lg text-pastel-muted hover:bg-[#fff2eb] hover:text-[#ed6d46] disabled:opacity-40" aria-label="单张重试"><RefreshCw className={`h-4 w-4 ${isWorkingStatus(result.status) ? 'animate-spin' : ''}`} /></button>
                {result.imageUrl && <button type="button" onClick={() => downloadImage(result.imageUrl!, index)} className="flex h-11 w-11 items-center justify-center rounded-lg text-pastel-muted hover:bg-emerald-50 hover:text-emerald-600" aria-label="下载"><Download className="h-4 w-4" /></button>}
              </div>
            </div>
          </article>
        ))}
      </div>
      {activeRecord.step === 'complete' && <button type="button" onClick={startNewRecord} className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-pastel-border bg-pastel-bg text-sm font-black hover:border-[#ed6d46] hover:text-[#ed6d46]"><Plus className="h-4 w-4" />新开场景图任务</button>}
    </section>
  ) : null;

  return (
    <div className="h-full overflow-y-auto bg-[#eef6ff] text-pastel-text dark:bg-[#080a0d]">
      <div className="mx-auto w-full max-w-[105rem] px-3 py-5 sm:px-5 lg:px-8">
        <header className="relative mb-5 overflow-hidden rounded-[1.75rem] border border-[#d9e5f1] bg-white px-4 py-6 shadow-[0_14px_45px_rgba(33,66,104,0.07)] dark:border-white/10 dark:bg-[#11151c] sm:px-7 sm:py-7">
          <div className="absolute -right-16 -top-24 h-56 w-56 rounded-full border-[2rem] border-[#edf5fd] bg-[#fff2e9] dark:border-white/[0.03] dark:bg-[#ed6d46]/5" />
          <div className="relative text-center">
            <div className="inline-flex items-center gap-2 text-xs font-black tracking-[0.14em] text-[#6f8199]"><Sparkles className="h-4 w-4 text-[#ed6d46]" />AI 场景视觉 Agent</div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-[#142139] dark:text-white sm:text-3xl">生成高转化场景图</h1>
            <p className="mx-auto mt-2 max-w-3xl text-sm leading-6 text-pastel-muted">基于产品基因与卖点，生成匹配曝光场景与目标视角的商业级场景图。</p>
            <WorkflowSteps step={activeRecord.step} />
          </div>
        </header>

        {/* Floating Left-Bottom Collapsed Record Button (Matches 图3/图4) */}
        {!isHistoryOpen && (
          <button type="button" onClick={() => setIsHistoryOpen(true)} className="fixed bottom-5 left-4 z-40 flex min-h-12 items-center gap-2 rounded-full border border-pastel-border bg-white px-4 text-sm font-black shadow-[0_8px_24px_rgba(30,50,80,0.16)] xl:left-24">
            <PanelLeftOpen className="h-4 w-4 text-[#ed6d46]" />
            生成记录
            <span className="rounded-full bg-pastel-bg px-2 py-1 text-xs text-pastel-muted">{records.length}</span>
          </button>
        )}
        {isHistoryOpen && <button type="button" className="fixed inset-0 z-[69] bg-[#10203a]/35 xl:hidden" onClick={() => setIsHistoryOpen(false)} aria-label="关闭生成记录" />}

        <div className={`grid grid-cols-1 gap-5 ${isHistoryOpen ? 'xl:grid-cols-[17rem_minmax(23rem,31rem)_minmax(0,1fr)]' : 'xl:grid-cols-[minmax(23rem,31rem)_minmax(0,1fr)]'}`}>
          {isHistoryOpen && <div className="fixed inset-y-3 left-3 z-[70] w-[min(18rem,calc(100vw-1.5rem))] xl:sticky xl:top-4 xl:z-10 xl:h-[calc(100vh-7rem)] xl:w-auto xl:self-start">{historyPanel}</div>}
          {inputPanel}
          <div className="flex min-w-0 flex-col gap-4">
            {activeRecord.error && <div className="flex min-h-12 items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{activeRecord.error}</span></div>}
            
            {/* Empty State placeholder (Matches 图4) */}
            {activeRecord.step === 'input' && !activeRecord.analysis && (
              <section className="flex min-h-[34rem] flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#cedbe8] bg-white/75 p-8 text-center">
                <span className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-[#fff1e8] text-[#ed6d46]"><Store className="h-9 w-9" /></span>
                <h2 className="mt-5 text-xl font-black text-[#17243c]">先理解产品，再选择场景表达</h2>
                <p className="mt-2 max-w-lg text-sm leading-7 text-pastel-muted">Agent会识别商品结构、卖点与目标人群，建立场景构图与氛围方案；确认后才生成视觉底图。</p>
                <div className="mt-6 grid w-full max-w-xl gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-white p-3 text-left shadow-sm"><Store className="h-4 w-4 text-[#ed6d46]" /><strong className="mt-2 block text-xs">6个场景板块</strong></div>
                  <div className="rounded-xl bg-white p-3 text-left shadow-sm"><Sparkles className="h-4 w-4 text-[#2d6bb1]" /><strong className="mt-2 block text-xs">尺寸精密比例</strong></div>
                  <div className="rounded-xl bg-white p-3 text-left shadow-sm"><WandSparkles className="h-4 w-4 text-emerald-600" /><strong className="mt-2 block text-xs">可选风格水准</strong></div>
                </div>
              </section>
            )}

            {/* Analyzing Loading Card (Matches 图5) */}
            {activeRecord.step === 'analyzing' && (
              <section className="flex min-h-[34rem] flex-1 flex-col items-center justify-center rounded-2xl border border-pastel-border bg-white p-8 text-center shadow-sm">
                <div className="relative flex h-24 w-24 items-center justify-center">
                  <span className="absolute inset-0 animate-ping rounded-full bg-[#ed6d46]/10" />
                  <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[#17243c] text-white"><Loader2 className="h-7 w-7 animate-spin" /></span>
                </div>
                <h2 className="mt-6 text-xl font-black">Agent正在建立场景化方案</h2>
                <p className="mt-2 max-w-md text-sm leading-7 text-pastel-muted">校验商品身份、提取真实卖点、规划场景构图与构图角度。</p>
              </section>
            )}

            {confirmPanel}
            {resultPanel}
          </div>
        </div>
      </div>

      {selectionModal === 'ratio' && (
        <SelectionModal title="选择尺寸比例" onClose={() => setSelectionModal(null)}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ECOMMERCE_RATIOS.map((ratio) => {
              const [w, h] = String(ratio.id).split(':').map(Number);
              const scale = 70 / Math.max(w, h);
              const isSelected = activeRecord.aspectRatio === ratio.id;
              return (
                <button
                  key={ratio.id}
                  type="button"
                  onClick={() => {
                    patchActive({ aspectRatio: ratio.id });
                    setSelectionModal(null);
                  }}
                  className={`relative flex min-h-44 flex-col items-center justify-center rounded-2xl border-2 bg-pastel-bg p-4 transition hover:-translate-y-1 ${isSelected ? 'border-[#17243c] bg-white shadow-lg' : 'border-transparent bg-pastel-bg/60'}`}
                >
                  <span className="block rounded border-[3px] border-[#7a8492]" style={{ width: Math.max(24, w * scale), height: Math.max(24, h * scale) }} />
                  <strong className="mt-4 text-base font-black text-[#17243c]">{ratio.label}</strong>
                  {isSelected && <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-[#17243c]" />}
                </button>
              );
            })}
          </div>
        </SelectionModal>
      )}
      {selectionModal === 'board' && (
        <SelectionModal title="选择场景板块" onClose={() => setSelectionModal(null)}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(SCENE_BOARD_CONFIGS) as BoardType[]).map((key) => {
              const board = SCENE_BOARD_CONFIGS[key];
              const isSelected = activeRecord.boardType === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    patchActive({ boardType: key });
                    setSelectionModal(null);
                  }}
                  className={`relative flex min-h-32 flex-col justify-between rounded-2xl border-2 p-4 text-left transition hover:-translate-y-1 ${isSelected ? 'border-[#ed6d46] bg-[#fff8f3] shadow-md' : 'border-transparent bg-pastel-bg/60'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xl shadow-sm">
                      {board.icon}
                    </span>
                    {isSelected && <CheckCircle2 className="h-5 w-5 text-[#ed6d46]" />}
                  </div>
                  <div className="mt-3">
                    <strong className="block text-base font-black text-[#17243c]">{board.label}</strong>
                    <small className="mt-1 block text-xs leading-4 text-pastel-muted">{board.description}</small>
                  </div>
                </button>
              );
            })}
          </div>
        </SelectionModal>
      )}
      {isStyleOpen && <StyleLibraryModal record={activeRecord} customStyles={customStyles} mutationError={styleMutationError} onSelectPreset={(id) => patchActive({ selectedPresetId: id, selectedCustomStyleId: null })} onSelectCustom={(id) => patchActive({ selectedCustomStyleId: id, selectedPresetId: null })} onCreate={createCustomStyle} onRename={renameCustomStyle} onDelete={deleteCustomStyle} onClose={() => setIsStyleOpen(false)} />}
      {selectedPreview && <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 p-4" onClick={() => setSelectedPreview(null)}><button type="button" onClick={() => setSelectedPreview(null)} className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white" aria-label="关闭预览"><X className="h-6 w-6" /></button><img src={selectedPreview} alt="生成场景图大图预览" className="max-h-[88vh] max-w-full rounded-xl object-contain" /></div>}
    </div>
  );
};

export default SceneGenerationTab;
