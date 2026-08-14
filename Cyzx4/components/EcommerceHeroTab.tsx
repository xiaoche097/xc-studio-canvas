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
  WandSparkles,
  X,
} from 'lucide-react';
import { AspectRatio, ImageResolution } from '../types';
import { compressImage, generateImageToImage, generateText } from '../services/geminiService';
import { useImagePaste } from '../hooks/useImagePaste';
import { useCancelableGeneration } from '../hooks/useCancelableGeneration';
import { getErrorMessage, isAbortError } from '../utils/apiHelpers';
import { convertImageDataUrlFormat, getImageDownloadExtension } from '../utils/imageFormat';
import { saveGeneratedProject } from '../../services/projectHistoryService';
import { composeEcommerceHeroText } from '../utils/ecommerceTextComposer';
import { ecommerceStyleLibrary } from '../services/ecommerceStyleLibrary';
import {
  ECOMMERCE_LANGUAGES,
  ECOMMERCE_PLATFORMS,
  ECOMMERCE_RATIOS,
  ECOMMERCE_STYLE_PRESETS,
  languageById,
  platformById,
  stylePresetById,
  type EcommerceStylePreset,
} from '../constants/ecommerceHeroPresets';
import type {
  EcommerceCustomStyle,
  EcommerceHeroAnalysis,
  EcommerceHeroRecord,
  EcommerceHeroResult,
  EcommerceImageModelId,
  EcommerceLanguageId,
  EcommercePlatformId,
  EcommerceResultStatus,
  EcommerceStyleAnalysis,
  EcommerceUploadedImage,
} from '../types/ecommerceHero.types';
import './EcommerceHeroTab.css';

const MAX_PRODUCT_IMAGES = 8;
const MAX_STYLE_IMAGES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_RECORDS = 20;
const DEFAULT_MODEL_ID: EcommerceImageModelId = 'gpt-image-2';
const IMAGE_MODEL_OPTIONS: Array<{ id: EcommerceImageModelId; label: string; description: string; badge: string }> = [
  { id: 'gpt-image-2', label: 'GPT Image 2', description: 'Ultra Quality', badge: '默认' },
  { id: 'gemini-3.1-flash-image-preview', label: 'Gemini Banana 2', description: '快速稳定', badge: 'Gemini' },
  { id: 'qwen-image-3.0-pro', label: '千问3.0pro', description: '高质量图像生成与编辑', badge: '千问' },
];
const imageModelById = (id: EcommerceImageModelId) => IMAGE_MODEL_OPTIONS.find((model) => model.id === id) || IMAGE_MODEL_OPTIONS[0];
const ACCEPTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/x-png', 'image/pjpeg']);

const isValidImageType = (file: File) => {
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/x-png', 'image/pjpeg'];
  const validExts = ['.jpg', '.jpeg', '.png', '.webp'];
  return validTypes.includes(type) || validExts.some((ext) => name.endsWith(ext));
};

const STEPS: Array<{ id: EcommerceHeroRecord['step']; label: string }> = [
  { id: 'input', label: '输入' },
  { id: 'analyzing', label: 'AI分析' },
  { id: 'confirm', label: '确认规划' },
  { id: 'generating', label: '生成中' },
  { id: 'complete', label: '完成' },
];

const createRecord = (): EcommerceHeroRecord => ({
  id: crypto.randomUUID(),
  createdAt: Date.now(),
  step: 'input',
  mode: 'standard',
  productImages: [],
  requirements: '',
  language: 'zh-CN',
  platform: 'smart',
  aspectRatio: AspectRatio.PORTRAIT_3_4,
  resolution: ImageResolution.RES_2K,
  modelId: DEFAULT_MODEL_ID,
  outputCount: 3,
  oneClick: false,
  selectedPresetId: null,
  selectedCustomStyleId: null,
  analysis: null,
  results: [],
  error: '',
});

const toApiImage = (image: EcommerceUploadedImage) => ({ base64: image.base64, mimeType: image.mime });
const toDataUrl = (image: EcommerceUploadedImage) => `data:${image.mime};base64,${image.base64}`;
const isWorkingStatus = (status: EcommerceResultStatus) => ['pending', 'submitting', 'processing', 'compositing'].includes(status);

const resultStatusLabel = (status: EcommerceResultStatus) => ({
  pending: '等待提交',
  submitting: '正在提交',
  processing: '生成视觉底图',
  compositing: '精确合成文案',
  done: '已完成',
  error: '生成失败',
  cancelled: '已取消',
})[status];

const resultAspectClass = (ratio: AspectRatio) => {
  if (ratio === AspectRatio.SQUARE) return 'aspect-square';
  if (ratio === AspectRatio.PORTRAIT_4_5) return 'aspect-[4/5]';
  if (ratio === AspectRatio.PORTRAIT_9_16) return 'aspect-[9/16]';
  if (ratio === AspectRatio.LANDSCAPE_4_3) return 'ecommerce-result-landscape aspect-[4/3]';
  if (ratio === AspectRatio.LANDSCAPE_5_4) return 'ecommerce-result-landscape aspect-[5/4]';
  if (ratio === AspectRatio.LANDSCAPE_16_9) return 'ecommerce-result-wide aspect-video';
  if (ratio === AspectRatio.LANDSCAPE_21_9) return 'ecommerce-result-wide aspect-[21/9]';
  return 'aspect-[3/4]';
};

const normalizeStringList = (value: unknown) => Array.isArray(value)
  ? value.map((item) => String(item).trim()).filter(Boolean)
  : [];

const parseJsonObject = (text: string) => {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Agent 未返回可识别的结构化方案，请重试。');
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    throw new Error('Agent 方案解析失败，请重试。');
  }
};

const parseHeroAnalysis = (
  text: string,
  count: number,
  fallbackPlatform: EcommercePlatformId,
  language: EcommerceLanguageId,
): EcommerceHeroAnalysis => {
  const parsed = parseJsonObject(text);
  const required = ['productIdentity', 'productName', 'productCategory', 'materialColor', 'targetAudience', 'platformReason', 'platformVisualStrategy', 'backgroundComposition'];
  if (required.some((key) => typeof parsed[key] !== 'string' || !String(parsed[key]).trim())) {
    throw new Error('Agent 返回的产品或平台方案不完整，请重试。');
  }
  const availablePlatforms = new Set(ECOMMERCE_PLATFORMS.filter((item) => item.id !== 'smart').map((item) => item.id));
  const recommended = availablePlatforms.has(parsed.recommendedPlatform as EcommercePlatformId)
    ? parsed.recommendedPlatform as EcommercePlatformId
    : fallbackPlatform === 'smart' ? 'amazon-aplus' : fallbackPlatform;
  const safeZones = new Set(['top', 'bottom', 'left', 'right']);
  const safeZone = safeZones.has(String(parsed.typographySafeZone))
    ? String(parsed.typographySafeZone) as EcommerceHeroAnalysis['typographySafeZone']
    : 'left';
  const rawCopy = parsed.copy && typeof parsed.copy === 'object' ? parsed.copy as Record<string, unknown> : {};
  const imagePlans = normalizeStringList(parsed.imagePlans);
  while (imagePlans.length < count) imagePlans.push(`生成第 ${imagePlans.length + 1} 张平台化产品主视觉，保持同款商品身份并采用差异化构图。`);
  return {
    productIdentity: String(parsed.productIdentity).trim(),
    productName: String(parsed.productName).trim(),
    productCategory: String(parsed.productCategory).trim(),
    materialColor: String(parsed.materialColor).trim(),
    nativeBrandMarks: normalizeStringList(parsed.nativeBrandMarks),
    sellingPoints: normalizeStringList(parsed.sellingPoints).slice(0, 6),
    targetAudience: String(parsed.targetAudience).trim(),
    recommendedPlatform: recommended,
    platformReason: String(parsed.platformReason).trim(),
    platformVisualStrategy: String(parsed.platformVisualStrategy).trim(),
    backgroundComposition: String(parsed.backgroundComposition).trim(),
    typographySafeZone: safeZone,
    copy: language === 'none' ? { headline: '', subheadline: '', badges: [] } : {
      headline: String(rawCopy.headline || '').trim(),
      subheadline: String(rawCopy.subheadline || '').trim(),
      badges: normalizeStringList(rawCopy.badges).slice(0, 3),
    },
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
    palette: stringValue('palette', '提取参考图的主要颜色关系'),
    lighting: stringValue('lighting', '匹配参考图的光线方向和明暗层次'),
    background: stringValue('background', '提取参考图的背景材质与空间氛围'),
    composition: stringValue('composition', '匹配参考图的主体占比和视觉动线'),
    propDensity: stringValue('propDensity', '克制且不遮挡商品'),
    typographyDensity: stringValue('typographyDensity', '保留清晰的文案安全区'),
    forbiddenElements: normalizeStringList(parsed.forbiddenElements),
    promptBlock: stringValue('promptBlock', 'Use the reference images only for visual style, never for product identity.'),
  };
};

const styleSummary = (record: EcommerceHeroRecord, customStyles: EcommerceCustomStyle[]) => {
  const preset = stylePresetById(record.selectedPresetId);
  if (preset) return { name: preset.name, prompt: preset.prompt, references: [] as EcommerceUploadedImage[] };
  const custom = customStyles.find((item) => item.id === record.selectedCustomStyleId);
  if (!custom) return { name: '平台智能风格', prompt: 'Use the marketplace visual system and product analysis without an additional style reference.', references: [] as EcommerceUploadedImage[] };
  return {
    name: custom.name,
    prompt: [custom.analysis.palette, custom.analysis.lighting, custom.analysis.background, custom.analysis.composition, custom.analysis.propDensity, custom.analysis.promptBlock].join('. '),
    references: custom.referenceImages.map((dataUrl, index) => {
      const parts = dataUrl.split(';base64,');
      if (parts.length === 2) {
        const mime = parts[0].replace(/^data:/, '') || 'image/png';
        const base64 = parts[1].trim();
        return { id: `${custom.id}-${index}`, name: `${custom.name}-${index + 1}`, mime, base64, preview: dataUrl };
      }
      return null;
    }).filter((item): item is EcommerceUploadedImage => Boolean(item)),
  };
};

const buildAnalysisPrompt = (record: EcommerceHeroRecord, styleName: string, stylePrompt: string) => {
  const language = languageById(record.language);
  const selectedPlatform = platformById(record.platform);
  const platformIds = ECOMMERCE_PLATFORMS.filter((item) => item.id !== 'smart').map((item) => item.id).join(', ');
  return `
You are a senior multi-marketplace ecommerce art director and product analyst.

Analyze Images 1-${record.productImages.length} as multiple views/details of ONE identical product SKU. Product pixels and explicit user facts are the source of truth.

CURRENT SETTINGS
- Requested platform: ${selectedPlatform.label} (${record.platform})
- Target language for newly added marketing copy: ${language.promptName}
- Output ratio: ${record.aspectRatio}
- Output count: ${record.outputCount}
- Visual style: ${styleName}
- Style direction: ${stylePrompt}
- User requirements (highest priority after product facts and platform rules): ${record.requirements.trim() || 'No additional requirements.'}

RULES
- If platform is smart, recommend exactly one id from: ${platformIds}. Explain why it fits the product, language and user requirements.
- If a concrete platform was selected, keep it as recommendedPlatform.
- Product identity and user-corrected facts outrank platform rules; platform composition/readability rules outrank creative style.
- Infer native logos or packaging text conservatively. Never invent invisible product facts.
- Marketing copy must be concise, truthful and only in ${language.promptName}. Do not translate or rewrite native product labels.
- If target language is no added marketing text, return empty headline, subheadline and badges.
- Plan exactly ${record.outputCount} distinct images. Every image must preserve the same SKU.

Return ONLY valid JSON, no markdown:
{
  "productIdentity":"specific product identity and immutable detail summary",
  "productName":"editable product name in Chinese",
  "productCategory":"specific category",
  "materialColor":"materials, finish and colors",
  "nativeBrandMarks":["visible native logo or label to preserve"],
  "sellingPoints":["truthful product selling point"],
  "targetAudience":"audience",
  "recommendedPlatform":"platform id",
  "platformReason":"Chinese recommendation reason",
  "platformVisualStrategy":"Chinese platform-specific visual strategy",
  "backgroundComposition":"Chinese background, product occupancy, lighting and composition plan",
  "typographySafeZone":"top|bottom|left|right",
  "copy":{"headline":"exact target-language headline","subheadline":"exact target-language subheadline","badges":["exact short badge"]},
  "imagePlans":["one Chinese visual plan per output"],
  "riskWarnings":["product fidelity, copy or platform risk to verify"]
}
`.trim();
};

const buildGenerationPrompt = (
  record: EcommerceHeroRecord,
  analysis: EcommerceHeroAnalysis,
  index: number,
  styleName: string,
  stylePrompt: string,
  styleReferenceCount: number,
) => {
  const selectedPlatform = platformById(record.platform === 'smart' ? analysis.recommendedPlatform : record.platform);
  const productEnd = record.productImages.length;
  return `
Create ONE premium ecommerce hero VISUAL BASE, variation ${index + 1} of ${record.outputCount}.

IMAGE ROUTING
- Images 1-${productEnd}: multiple views/details of ONE identical product SKU; these images are the only product identity source.
${styleReferenceCount ? `- Images ${productEnd + 1}-${productEnd + styleReferenceCount}: visual style references only. Never copy their products, people, text, logos or layout content.` : '- No visual style reference image is supplied.'}

PRODUCT LOCK
- Product: ${analysis.productIdentity}
- Category: ${analysis.productCategory}
- Material/color: ${analysis.materialColor}
${analysis.nativeBrandMarks.map((item) => `- Preserve native mark: ${item}`).join('\n')}
- Preserve exact silhouette, proportions, construction, color, finish, pattern, packaging and native labels across all references.

PLATFORM SYSTEM
- Platform: ${selectedPlatform.label}
- Platform rules: ${selectedPlatform.prompt}
- Confirmed strategy: ${analysis.platformVisualStrategy}
- Background/composition: ${analysis.backgroundComposition}
- This image plan: ${analysis.imagePlans[index] || analysis.imagePlans[0]}
- Reserve a calm, low-detail ${analysis.typographySafeZone} safe zone occupying about 30% of the canvas for later deterministic copy composition.

STYLE
- Selected style: ${styleName}
- Style direction: ${stylePrompt}
- Platform product readability and composition rules override conflicting style cues.

USER REQUIREMENTS
${record.requirements.trim() || 'No additional requirements.'}

ABSOLUTE TEXT POLICY
- Do not render added marketing copy, headline, subheadline, badges, prices, promotional symbols, platform logos or watermark.
- Preserve only native text and logos physically printed on the source product or packaging.

OUTPUT
- One complete image only, ${record.aspectRatio}, no collage, no comparison grid, no before/after layout.
- No extra product, product redesign, invented parts, floating object, distorted geometry or fake CGI material.
`.trim();
};

const readUploadedFiles = async (files: File[], max: number, currentCount: number) => {
  const imageFiles = files.filter(isValidImageType);
  const accepted = imageFiles.filter((file) => file.size <= MAX_FILE_SIZE).slice(0, Math.max(0, max - currentCount));
  const uploaded = await Promise.all(accepted.map(async (file): Promise<EcommerceUploadedImage> => {
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

const WorkflowSteps: React.FC<{ step: EcommerceHeroRecord['step'] }> = ({ step }) => {
  const current = STEPS.findIndex((item) => item.id === step);
  return (
    <div className="no-scrollbar mt-5 flex items-center justify-start gap-2 overflow-x-auto pb-1 sm:justify-center">
      {STEPS.map((item, index) => (
        <React.Fragment key={item.id}>
          <div className={`flex min-w-fit items-center gap-2 text-xs font-black ${index <= current ? 'text-[#17243c] dark:text-white' : 'text-[#93a2b6]'}`}>
            <span className={`flex h-8 w-8 items-center justify-center rounded-full border ${index < current ? 'border-emerald-500 bg-emerald-500 text-white' : index === current ? 'border-[#17243c] bg-[#17243c] text-white' : 'border-[#d8e2ec] bg-white text-[#93a2b6] dark:bg-white/5'}`}>{index < current ? <Check className="h-4 w-4" /> : index + 1}</span>
            <span>{item.label}</span>
          </div>
          {index < STEPS.length - 1 && <span className="h-px w-7 shrink-0 bg-[#d8e2ec] sm:w-12" />}
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
        <header className="flex min-h-16 items-center justify-between border-b border-pastel-border px-5 sm:px-6"><h2 className="text-base font-black">{title}</h2><button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-xl bg-pastel-bg text-pastel-muted" aria-label="关闭"><X className="h-5 w-5" /></button></header>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
      </section>
    </div>
  );
};

interface StyleLibraryModalProps {
  record: EcommerceHeroRecord;
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
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (incomingFiles: File[]) => {
    const valid = incomingFiles.filter((file) => isValidImageType(file) && file.size <= MAX_FILE_SIZE);
    if (!valid.length && incomingFiles.length > 0) {
      setCreateError('请选择有效的图片文件（JPG/PNG/WEBP，单张不超过5MB）');
      return;
    }
    setCreateError('');
    setFiles((prev) => {
      const combined = [...prev, ...valid];
      return combined.slice(0, MAX_STYLE_IMAGES);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

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
          <p className="text-sm font-black text-[#17243c]">平台规则优先，风格负责色彩、光线和氛围</p>
          <p className="mt-1 text-xs leading-5 text-[#718198]">可选择内置预设，也可上传1–5张参考图创建浏览器本地风格。</p>
        </div>
        <button type="button" onClick={() => setCreating((value) => !value)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#ed6d46] px-4 text-xs font-black text-white hover:bg-[#d8552e]">
          <Plus className="h-4 w-4" />创建自定义风格
        </button>
      </div>
      {creating && (
        <div className="mb-6 grid gap-3 rounded-2xl border border-[#d9e5f1] bg-[#f8fbff] p-4 sm:grid-cols-[1fr_1.3fr_auto] sm:items-end">
          <label className="text-xs font-black text-pastel-muted">
            风格名称
            <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-pastel-border bg-white px-3 text-sm text-pastel-text" placeholder="例如：奶油家居自然光" />
          </label>
          <div className="text-xs font-black text-pastel-muted">
            参考图（1–5张，点击或拖入）
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`mt-1 flex min-h-11 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-3 transition ${
                isDragging
                  ? 'border-[#ed6d46] bg-[#fff8f3]'
                  : files.length
                  ? 'border-[#b9c9dc] bg-white'
                  : 'border-[#b9c9dc] bg-white hover:border-[#ed6d46]'
              }`}
            >
              {files.length ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#17243c]">已选择 {files.length} / 5 张参考图</span>
                  <span className="text-[0.68rem] text-pastel-muted">(点击或拖入追加)</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs font-bold text-[#405773]">
                  <Upload className="h-4 w-4 text-[#ed6d46]" />
                  <span>点击选择或拖入参考图（1–5张）</span>
                </div>
              )}
            </div>
            {files.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {files.map((file, idx) => {
                  const previewUrl = URL.createObjectURL(file);
                  return (
                    <div key={idx} className="relative h-12 w-12 overflow-hidden rounded-lg border border-slate-200 group">
                      <img src={previewUrl} alt={file.name} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFiles((prev) => prev.filter((_, i) => i !== idx));
                        }}
                        className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-500"
                        title="移除"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={(event) => {
                if (event.target.files?.length) {
                  handleFiles(Array.from(event.target.files));
                  event.target.value = '';
                }
              }}
            />
          </div>
          <button type="button" onClick={() => void submit()} disabled={!name.trim() || !files.length || saving} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#17243c] px-5 text-xs font-black text-white disabled:opacity-40">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}保存风格
          </button>
          {createError && <p className="text-xs font-bold text-red-600 sm:col-span-3">{createError}</p>}
        </div>
      )}
      {mutationError && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700">{mutationError}</div>}
      <div><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-black">场景色调调性风格预设</h3><span className="text-xs text-pastel-muted">{ECOMMERCE_STYLE_PRESETS.length} 个预设</span></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{ECOMMERCE_STYLE_PRESETS.map((style) => <button key={style.id} type="button" onClick={() => { onSelectPreset(style.id); onClose(); }} className={`group min-h-44 overflow-hidden rounded-2xl border-2 text-left transition hover:-translate-y-1 ${record.selectedPresetId === style.id ? 'border-[#ed6d46] shadow-[0_10px_24px_rgba(237,109,70,0.18)]' : 'border-transparent bg-pastel-bg'}`}><span className="block h-24" style={{ background: `linear-gradient(135deg, ${style.palette[0]}, ${style.palette[1]} 55%, ${style.palette[2]})` }} /><span className="block p-3"><strong className="block text-xs font-black">{style.name}</strong><span className="mt-1 block text-[0.68rem] leading-4 text-pastel-muted">{style.description}</span></span></button>)}</div></div>
      <div className="mt-7"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-black">我的自定义风格</h3><span className="text-xs text-pastel-muted">保存在当前浏览器</span></div>{customStyles.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{customStyles.map((style) => <article key={style.id} className={`group overflow-hidden rounded-2xl border-2 ${record.selectedCustomStyleId === style.id ? 'border-[#ed6d46]' : 'border-pastel-border'}`}><button type="button" onClick={() => { onSelectCustom(style.id); onClose(); }} className="block w-full text-left"><img src={style.thumbnail} alt={style.name} className="h-28 w-full object-cover" /><span className="block p-3 text-xs font-black">{style.name}</span></button><div className="flex border-t border-pastel-border"><button type="button" onClick={() => void onRename(style)} className="min-h-11 flex-1 text-xs font-bold text-pastel-muted hover:text-[#ed6d46]">重命名</button><button type="button" onClick={() => void onDelete(style)} className="flex min-h-11 w-11 items-center justify-center text-pastel-muted hover:text-red-500" aria-label={`删除${style.name}`}><Trash2 className="h-4 w-4" /></button></div></article>)}</div> : <div className="flex min-h-32 items-center justify-center rounded-2xl border border-dashed border-pastel-border bg-pastel-bg text-sm text-pastel-muted">还没有自定义风格</div>}</div>
      <button type="button" onClick={() => { onSelectPreset(null); onSelectCustom(null); onClose(); }} className="mt-6 min-h-11 rounded-xl border border-pastel-border px-4 text-xs font-black text-pastel-muted hover:bg-pastel-bg">清除风格选择</button>
    </SelectionModal>
  );
};

const EcommerceHeroTab: React.FC<{ isActive?: boolean }> = ({ isActive = true }) => {
  const initialRecordRef = useRef<EcommerceHeroRecord | null>(null);
  if (!initialRecordRef.current) initialRecordRef.current = createRecord();
  const [records, setRecords] = useState<EcommerceHeroRecord[]>([initialRecordRef.current]);
  const [activeRecordId, setActiveRecordId] = useState(initialRecordRef.current.id);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [selectionModal, setSelectionModal] = useState<'language' | 'platform' | 'ratio' | null>(null);
  const [isStyleOpen, setIsStyleOpen] = useState(false);
  const [customStyles, setCustomStyles] = useState<EcommerceCustomStyle[]>([]);
  const [styleMutationError, setStyleMutationError] = useState('');
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const productInputRef = useRef<HTMLInputElement>(null);
  const {
    cancelMessage,
    startGenerationTask,
    cancelGenerationTask,
    assertCurrentGenerationTask,
    finishGenerationTask,
  } = useCancelableGeneration();

  const activeRecord = useMemo(() => records.find((record) => record.id === activeRecordId) || records[0], [records, activeRecordId]);
  const isBusy = activeRecord.step === 'analyzing' || activeRecord.step === 'generating';
  const selectedLanguage = languageById(activeRecord.language);
  const selectedPlatform = platformById(activeRecord.platform);
  const selectedRatio = ECOMMERCE_RATIOS.find((item) => item.id === activeRecord.aspectRatio) || ECOMMERCE_RATIOS[0];
  const selectedStyle = styleSummary(activeRecord, customStyles);
  const selectedImageModel = imageModelById(activeRecord.modelId);

  useEffect(() => {
    ecommerceStyleLibrary.list().then(setCustomStyles).catch(() => setStyleMutationError('自定义风格库读取失败，本次仍可使用内置风格。'));
  }, []);

  const updateRecord = useCallback((id: string, updater: (record: EcommerceHeroRecord) => EcommerceHeroRecord) => {
    setRecords((current) => current.map((record) => record.id === id ? updater(record) : record));
  }, []);

  const patchActive = useCallback((patch: Partial<EcommerceHeroRecord>) => {
    updateRecord(activeRecordId, (record) => ({ ...record, ...patch }));
  }, [activeRecordId, updateRecord]);

  const patchAnalysis = useCallback((patch: Partial<EcommerceHeroAnalysis>) => {
    updateRecord(activeRecordId, (record) => record.analysis ? { ...record, analysis: { ...record.analysis, ...patch } } : record);
  }, [activeRecordId, updateRecord]);

  const processProductFiles = useCallback(async (files: File[]) => {
    if (isBusy) return;
    try {
      const { uploaded, imageFiles, accepted } = await readUploadedFiles(files, MAX_PRODUCT_IMAGES, activeRecord.productImages.length);
      if (!uploaded.length) {
        const message = imageFiles.some((file) => file.size > MAX_FILE_SIZE) ? '单张图片不能超过5MB。' : imageFiles.length ? '最多上传8张产品图。' : '仅支持JPG、JPEG、PNG或WEBP图片。';
        patchActive({ error: message });
        return;
      }
      updateRecord(activeRecord.id, (record) => ({
        ...record,
        productImages: [...record.productImages, ...uploaded].slice(0, MAX_PRODUCT_IMAGES),
        analysis: null,
        results: [],
        step: 'input',
        error: imageFiles.length > accepted.length ? '部分图片未加入：最多8张且单张不超过5MB。' : '',
      }));
    } catch (error) {
      patchActive({ error: getErrorMessage(error) });
    }
  }, [activeRecord.id, activeRecord.productImages.length, isBusy, patchActive, updateRecord]);

  useImagePaste((files) => void processProductFiles(files), isActive && !isBusy && activeRecord.step === 'input' && !selectionModal && !isStyleOpen);

  const removeProductImage = (id: string) => updateRecord(activeRecord.id, (record) => ({ ...record, productImages: record.productImages.filter((image) => image.id !== id), analysis: null, results: [], error: '' }));

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
    if (!uploaded.length) throw new Error('请上传1–5张有效参考图。');
    const text = await generateText(uploaded.map(toApiImage), `
You are an ecommerce visual style analyst. Analyze these images ONLY as style references, not as product identity.
Extract palette, lighting, background materials, composition, prop density, typography density and forbidden elements.
Return ONLY JSON:
{"palette":"","lighting":"","background":"","composition":"","propDensity":"","typographyDensity":"","forbiddenElements":[""],"promptBlock":"concise English style prompt, no copied products, people, logos or text"}
`.trim());
    const analysis = parseStyleAnalysis(text);
    const now = Date.now();
    const style: EcommerceCustomStyle = { id: crypto.randomUUID(), name, createdAt: now, updatedAt: now, thumbnail: uploaded[0].preview, referenceImages: uploaded.map((item) => item.preview), analysis };
    setCustomStyles((current) => [style, ...current]);
    patchActive({ selectedCustomStyleId: style.id, selectedPresetId: null });
    try {
      await ecommerceStyleLibrary.save(style);
    } catch {
      setStyleMutationError('浏览器存储空间不足：该风格本次任务可用，但刷新后可能丢失。');
    }
  };

  const renameCustomStyle = async (style: EcommerceCustomStyle) => {
    const name = window.prompt('输入新的风格名称', style.name)?.trim();
    if (!name || name === style.name) return;
    const next = { ...style, name, updatedAt: Date.now() };
    setCustomStyles((current) => current.map((item) => item.id === style.id ? next : item));
    try { await ecommerceStyleLibrary.save(next); } catch { setStyleMutationError('重命名未能写入浏览器存储。'); }
  };

  const deleteCustomStyle = async (style: EcommerceCustomStyle) => {
    setCustomStyles((current) => current.filter((item) => item.id !== style.id));
    if (activeRecord.selectedCustomStyleId === style.id) patchActive({ selectedCustomStyleId: null });
    try { await ecommerceStyleLibrary.remove(style.id); } catch { setStyleMutationError('删除操作未能同步到浏览器存储。'); }
  };

  const updateResult = useCallback((recordId: string, resultId: string, patch: Partial<EcommerceHeroResult>) => {
    updateRecord(recordId, (record) => ({ ...record, results: record.results.map((result) => result.id === resultId ? { ...result, ...patch } : result) }));
  }, [updateRecord]);

  const generateOne = async (record: EcommerceHeroRecord, result: EcommerceHeroResult, index: number, signal: AbortSignal) => {
    if (!record.analysis) throw new Error('缺少已确认的Agent方案。');
    const style = styleSummary(record, customStyles);
    const prompt = buildGenerationPrompt(record, record.analysis, index, style.name, style.prompt, style.references.length);
    updateResult(record.id, result.id, { status: 'submitting', prompt, error: undefined });
    const [rawImage] = await generateImageToImage(
      [...record.productImages.map(toApiImage), ...style.references.map(toApiImage)],
      prompt,
      {
        aspectRatio: record.aspectRatio,
        resolution: record.resolution,
        modelId: record.modelId,
        workflowHint: 'ecommerce-hero',
        signal,
        onStatus: (status) => updateResult(record.id, result.id, { status: status === 'submitting' ? 'submitting' : 'processing' }),
      },
    );
    if (!rawImage) throw new Error('模型未返回视觉底图。');
    updateResult(record.id, result.id, { status: 'compositing', baseImageUrl: rawImage });
    const normalizedBase = await convertImageDataUrlFormat(rawImage, 'png');
    const finalImage = await composeEcommerceHeroText(normalizedBase, {
      language: record.language,
      copy: record.analysis.copy,
      safeZone: record.analysis.typographySafeZone,
      accentColor: platformById(record.platform === 'smart' ? record.analysis.recommendedPlatform : record.platform).accent,
      outputFormat: 'png',
    });
    return { ...result, status: 'done' as const, prompt, baseImageUrl: normalizedBase, imageUrl: finalImage };
  };

  const saveRecord = async (record: EcommerceHeroRecord, results: EcommerceHeroResult[]) => {
    const successful = results.filter((result) => result.status === 'done' && result.imageUrl);
    if (!successful.length) return;
    await saveGeneratedProject({
      type: 'MARKETING',
      generated: successful.map((result) => result.imageUrl!),
      original: [...record.productImages.map(toDataUrl), ...successful.map((result) => result.baseImageUrl!).filter(Boolean)],
      prompt: successful[0].prompt,
      thumbnail: successful[0].imageUrl,
      params: {
        source: 'Cyzx4/components/EcommerceHeroTab',
        subType: 'ecommerce_hero_batch',
        model: record.modelId,
        platform: record.platform,
        resolvedPlatform: record.platform === 'smart' ? record.analysis?.recommendedPlatform : record.platform,
        language: record.language,
        aspectRatio: record.aspectRatio,
        resolution: record.resolution,
        outputFormat: 'png',
        outputCount: results.length,
        productImageCount: record.productImages.length,
        baseImageCount: successful.length,
        mode: record.mode,
        selectedPresetId: record.selectedPresetId,
        selectedCustomStyleId: record.selectedCustomStyleId,
        requirements: record.requirements,
        analysis: record.analysis,
        resultStates: results.map((result) => ({ id: result.id, status: result.status, error: result.error })),
      },
    });
  };

  const runGeneration = async (sourceRecord: EcommerceHeroRecord) => {
    if (!sourceRecord.analysis) return;
    const generationStyle = styleSummary(sourceRecord, customStyles);
    const initialResults: EcommerceHeroResult[] = Array.from({ length: sourceRecord.outputCount }, () => ({ id: crypto.randomUUID(), status: 'pending', prompt: '' }));
    const snapshot: EcommerceHeroRecord = { ...sourceRecord, productImages: [...sourceRecord.productImages], results: initialResults, step: 'generating', error: '' };
    const { taskId, signal } = startGenerationTask();
    updateRecord(snapshot.id, () => snapshot);
    try {
      const settled = await Promise.allSettled(initialResults.map((result, index) => generateOne(snapshot, result, index, signal).catch((error) => {
        updateResult(snapshot.id, result.id, { status: isAbortError(error) ? 'cancelled' : 'error', error: isAbortError(error) ? '任务已取消' : getErrorMessage(error) });
        throw error;
      })));
      assertCurrentGenerationTask(taskId, signal);
      const finalResults = settled.map((outcome, index): EcommerceHeroResult => outcome.status === 'fulfilled'
        ? outcome.value
        : { ...initialResults[index], status: isAbortError(outcome.reason) ? 'cancelled' : 'error', prompt: buildGenerationPrompt(snapshot, snapshot.analysis!, index, generationStyle.name, generationStyle.prompt, generationStyle.references.length), error: isAbortError(outcome.reason) ? '任务已取消' : getErrorMessage(outcome.reason) });
      updateRecord(snapshot.id, (record) => ({ ...record, step: 'complete', results: finalResults, error: finalResults.every((result) => result.status !== 'done') ? '本次任务未生成成功，可单张重试。' : '' }));
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
    const snapshot: EcommerceHeroRecord = { ...activeRecord, productImages: [...activeRecord.productImages], results: [], analysis: null, error: '' };
    const analysisStyle = styleSummary(snapshot, customStyles);
    const { taskId, signal } = startGenerationTask();
    updateRecord(snapshot.id, (record) => ({ ...record, step: 'analyzing', analysis: null, results: [], error: '', createdAt: Date.now() }));
    try {
      const text = await generateText(snapshot.productImages.map(toApiImage), buildAnalysisPrompt(snapshot, analysisStyle.name, analysisStyle.prompt));
      assertCurrentGenerationTask(taskId, signal);
      const analysis = parseHeroAnalysis(text, snapshot.outputCount, snapshot.platform, snapshot.language);
      const resolved: EcommerceHeroRecord = { ...snapshot, analysis, platform: snapshot.platform === 'smart' ? analysis.recommendedPlatform : snapshot.platform, step: snapshot.oneClick ? 'generating' : 'confirm', error: '' };
      updateRecord(snapshot.id, () => resolved);
      finishGenerationTask(taskId);
      if (snapshot.oneClick) await runGeneration(resolved);
    } catch (error) {
      if (!isAbortError(error)) updateRecord(snapshot.id, (record) => ({ ...record, step: 'input', error: getErrorMessage(error) }));
      finishGenerationTask(taskId);
    }
  };

  const handleCancel = () => {
    cancelGenerationTask('已停止生成电商主图任务');
    updateRecord(activeRecord.id, (record) => ({ ...record, step: record.step === 'analyzing' ? 'input' : 'complete', results: record.results.map((result) => isWorkingStatus(result.status) ? { ...result, status: 'cancelled', error: '任务已取消' } : result) }));
  };

  const retryOne = async (resultId: string) => {
    if (!activeRecord.analysis || isBusy) return;
    const index = activeRecord.results.findIndex((result) => result.id === resultId);
    if (index < 0) return;
    const target = { ...activeRecord.results[index], status: 'pending' as const, error: undefined };
    const snapshot: EcommerceHeroRecord = { ...activeRecord, results: activeRecord.results.map((result) => result.id === resultId ? target : result), step: 'generating', error: '' };
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
    link.download = `生成电商主图-${index + 1}-${Date.now()}.${getImageDownloadExtension(src, 'png')}`;
    link.click();
  };

  const completedCount = activeRecord.results.filter((result) => result.status === 'done').length;
  const successfulResults = activeRecord.results.filter((result) => result.status === 'done' && result.imageUrl);

  const historyPanel = (
    <aside className="flex h-full flex-col rounded-2xl border border-[#d8e3ee] bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#11151c]">
      <div className="flex items-center justify-between px-1"><div><h2 className="text-base font-black">生成记录</h2><p className="mt-0.5 text-xs text-pastel-muted">当前会话最多20项</p></div><button type="button" onClick={() => setIsHistoryOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-pastel-border text-pastel-muted" aria-label="收起生成记录"><PanelLeftClose className="h-4 w-4" /></button></div>
      <button type="button" onClick={startNewRecord} disabled={isBusy} className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#17243c] text-sm font-black text-white disabled:opacity-40"><Plus className="h-4 w-4" />新开任务</button>
      <div className="mt-3 flex-1 space-y-2 overflow-y-auto">{records.map((record) => <button key={record.id} type="button" onClick={() => setActiveRecordId(record.id)} className={`group relative w-full overflow-hidden rounded-xl border p-3 text-left transition ${record.id === activeRecord.id ? 'border-[#ed6d46] bg-[#fff8f3]' : 'border-pastel-border bg-pastel-bg/40 hover:border-[#efb49d]'}`}><div className="flex items-start justify-between gap-2"><span className="truncate text-xs font-black">{record.analysis?.productName || '未命名产品'}</span><span className="shrink-0 rounded-full bg-white px-2 py-1 text-[0.62rem] font-bold text-pastel-muted">{STEPS.find((item) => item.id === record.step)?.label}</span></div><div className="mt-2 flex items-center justify-between text-[0.68rem] text-pastel-muted"><span>{platformById(record.platform).label} · {record.outputCount}张</span><span>{new Date(record.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div><span role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); deleteRecord(record.id); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.stopPropagation(); deleteRecord(record.id); } }} className="absolute bottom-2 right-2 hidden h-8 w-8 items-center justify-center rounded-lg bg-white text-red-400 shadow group-hover:flex" aria-label="删除记录"><Trash2 className="h-3.5 w-3.5" /></span></button>)}</div>
    </aside>
  );

  const inputPanel = activeRecord.step === 'input' || activeRecord.step === 'analyzing' ? (
    <div className="flex min-w-0 flex-col gap-4">
      <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-black">生成模型</h2>
            <p className="mt-1 text-xs leading-5 text-pastel-muted">默认使用GPT Image 2，也可切换Gemini Banana 2。</p>
          </div>
          <span className="rounded-full bg-[#fff0e8] px-2.5 py-1 text-[0.65rem] font-black text-[#d8552e]">{selectedImageModel.badge}</span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {IMAGE_MODEL_OPTIONS.map((model) => {
            const selected = activeRecord.modelId === model.id;
            return <button key={model.id} type="button" disabled={isBusy} onClick={() => patchActive({ modelId: model.id, results: [] })} className={`relative flex min-h-20 items-center gap-3 rounded-xl border p-3 text-left transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${selected ? 'border-[#ed6d46] bg-gradient-to-br from-[#fff7f2] to-[#eef5ff] shadow-[0_8px_20px_rgba(237,109,70,0.12)]' : 'border-pastel-border bg-pastel-bg/60 hover:border-[#efb49d]'}`}>
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${model.id === 'gpt-image-2' ? 'bg-[#17243c] text-white' : 'bg-[#e8f2ff] text-[#2d6bb1]'}`}><Sparkles className="h-5 w-5" /></span>
              <span className="min-w-0"><strong className="block truncate text-sm font-black">{model.label}</strong><small className="mt-1 block text-xs text-pastel-muted">{model.description}</small></span>
              {selected && <CheckCircle2 className="absolute right-2.5 top-2.5 h-4 w-4 text-[#ed6d46]" />}
            </button>;
          })}
        </div>
      </section>
      <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c] sm:p-5"><div><h2 className="text-base font-black">填写信息</h2><p className="mt-1 text-xs text-pastel-muted">普通模式快速生成，高级模式可注入风格。</p></div><div className="mt-4 grid grid-cols-2 rounded-xl bg-pastel-bg p-1"><button type="button" disabled={isBusy} onClick={() => patchActive({ mode: 'standard', selectedPresetId: null, selectedCustomStyleId: null })} className={`min-h-11 rounded-lg text-xs font-black ${activeRecord.mode === 'standard' ? 'bg-white text-[#17243c] shadow-sm' : 'text-pastel-muted'}`}>普通模式</button><button type="button" disabled={isBusy} onClick={() => patchActive({ mode: 'advanced' })} className={`min-h-11 rounded-lg text-xs font-black ${activeRecord.mode === 'advanced' ? 'bg-white text-[#17243c] shadow-sm' : 'text-pastel-muted'}`}>高级模式</button></div></section>
      <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c] sm:p-5"><div className="flex items-start justify-between gap-3"><div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf3ff] text-[#2d6bb1]"><ImageIcon className="h-5 w-5" /></span><div><h3 className="text-sm font-black">产品图</h3><p className="mt-1 text-xs leading-5 text-pastel-muted">同一款商品的多角度与规格细节，第一张为主身份。</p></div></div><span className="text-xs font-bold text-pastel-muted">{activeRecord.productImages.length}/8</span></div>{activeRecord.productImages.length > 0 && <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">{activeRecord.productImages.map((image, index) => <div key={image.id} className="group relative aspect-square overflow-hidden rounded-xl border border-pastel-border bg-pastel-bg"><img src={image.preview} alt={image.name} className="h-full w-full object-cover" />{index === 0 && <span className="absolute bottom-1 left-1 rounded bg-[#17243c] px-1.5 py-1 text-[0.55rem] font-black text-white">主身份</span>}<button type="button" disabled={isBusy} onClick={() => removeProductImage(image.id)} className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-full bg-[#17243c]/85 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100" aria-label={`删除${image.name}`}><X className="h-4 w-4" /></button></div>)}</div>}{activeRecord.productImages.length < MAX_PRODUCT_IMAGES && <button type="button" disabled={isBusy} onClick={() => productInputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void processProductFiles(Array.from(event.dataTransfer.files)); }} className="mt-4 flex min-h-32 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cbd8e8] bg-[#f8fbff] px-4 text-center hover:border-[#ed6d46] disabled:opacity-50"><Upload className="h-6 w-6 text-[#ed6d46]" /><span className="mt-2 text-sm font-black">拖拽、点击或Ctrl+V粘贴图片</span><span className="mt-1 text-xs text-pastel-muted">JPG / JPEG / PNG / WEBP · 单张≤5MB</span></button>}<input ref={productInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { void processProductFiles(Array.from(event.target.files || [])); event.target.value = ''; }} /></section>
      {activeRecord.mode === 'advanced' && <button type="button" onClick={() => setIsStyleOpen(true)} className="flex min-h-20 items-center justify-between rounded-2xl border border-[#efd9c9] bg-gradient-to-r from-[#fff8f2] to-white px-4 text-left shadow-sm"><span className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#ffd18f] via-[#e8d7a6] to-[#b9e8dd]"><WandSparkles className="h-5 w-5 text-[#8a4b2f]" /></span><span><strong className="block text-sm font-black">风格库</strong><small className="mt-1 block text-xs text-pastel-muted">{selectedStyle.name}</small></span></span><ChevronRight className="h-5 w-5 text-pastel-muted" /></button>}
      <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c] sm:p-5"><div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setSelectionModal('platform')} className="min-h-16 rounded-xl border border-pastel-border bg-pastel-bg p-3 text-left"><span className="text-[0.68rem] font-bold text-pastel-muted">目标平台</span><span className="mt-1 flex items-center justify-between text-sm font-black"><span className="flex items-center gap-2"><b className="flex h-7 min-w-7 items-center justify-center rounded-lg px-1 text-[0.65rem] text-white" style={{ backgroundColor: selectedPlatform.accent }}>{selectedPlatform.mark}</b>{selectedPlatform.label}</span><ChevronRight className="h-4 w-4 text-pastel-muted" /></span></button><button type="button" onClick={() => setSelectionModal('language')} className="min-h-16 rounded-xl border border-pastel-border bg-pastel-bg p-3 text-left"><span className="text-[0.68rem] font-bold text-pastel-muted">目标语言</span><span className="mt-1 flex items-center justify-between text-sm font-black"><span className="flex items-center gap-2"><Languages className="h-4 w-4 text-[#ed6d46]" />{selectedLanguage.label}</span><ChevronRight className="h-4 w-4 text-pastel-muted" /></span></button></div><label className="mt-4 block text-xs font-black text-pastel-muted">主图要求（选填）<textarea value={activeRecord.requirements} disabled={isBusy} onChange={(event) => patchActive({ requirements: event.target.value, analysis: null, results: [] })} className="mt-1 min-h-28 w-full resize-y rounded-xl border border-pastel-border bg-pastel-bg px-3 py-3 text-sm leading-6 text-pastel-text outline-none focus:border-[#ed6d46]" placeholder="描述产品事实、核心卖点、目标人群、希望使用的场景和必须避免的元素。用户事实修正会覆盖Agent推断。" /></label><div className="mt-4 grid grid-cols-2 gap-3"><button type="button" onClick={() => setSelectionModal('ratio')} className="min-h-16 rounded-xl border border-pastel-border bg-pastel-bg p-3 text-left"><span className="text-[0.68rem] font-bold text-pastel-muted">尺寸比例</span><span className="mt-1 flex items-center justify-between text-sm font-black">{selectedRatio.label}<ChevronRight className="h-4 w-4 text-pastel-muted" /></span></button><label className="rounded-xl border border-pastel-border bg-pastel-bg p-3 text-[0.68rem] font-bold text-pastel-muted">分辨率<select value={activeRecord.resolution} disabled={isBusy} onChange={(event) => patchActive({ resolution: event.target.value as ImageResolution })} className="mt-1 min-h-8 w-full bg-transparent text-sm font-black text-pastel-text outline-none"><option value={ImageResolution.RES_1K}>1K</option><option value={ImageResolution.RES_2K}>2K（默认）</option><option value={ImageResolution.RES_4K}>4K</option></select></label></div><div className="mt-4"><span className="text-xs font-black text-pastel-muted">生成数量</span><div className="mt-2 grid grid-cols-6 gap-2">{[1, 2, 3, 4, 5, 6].map((count) => <button key={count} type="button" disabled={isBusy} onClick={() => patchActive({ outputCount: count })} className={`min-h-11 rounded-xl border text-sm font-black ${activeRecord.outputCount === count ? 'border-[#ed6d46] bg-[#fff2eb] text-[#d8552e]' : 'border-pastel-border bg-white text-pastel-muted'}`}>{count}</button>)}</div></div></section>
      <label className="flex min-h-16 cursor-pointer items-center justify-between rounded-2xl border border-pastel-border bg-white px-4 shadow-sm"><span><strong className="block text-sm font-black">一键生图</strong><small className="mt-1 block text-xs text-pastel-muted">分析成功后跳过确认并自动生成</small></span><span className={`relative h-7 w-12 rounded-full transition ${activeRecord.oneClick ? 'bg-[#ed6d46]' : 'bg-[#d8e2ec]'}`}><input type="checkbox" checked={activeRecord.oneClick} disabled={isBusy} onChange={(event) => patchActive({ oneClick: event.target.checked })} className="sr-only" /><i className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${activeRecord.oneClick ? 'left-6' : 'left-1'}`} /></span></label>
      <button type="button" onClick={() => void handleAnalyze()} disabled={!activeRecord.productImages.length || isBusy} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#17243c] text-sm font-black text-white shadow-[0_14px_28px_rgba(23,36,60,0.18)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none">{activeRecord.step === 'analyzing' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5 text-[#ff9b67]" />}{activeRecord.step === 'analyzing' ? 'Agent正在分析产品与平台…' : '分析产品，生成主图方案'}</button>
      {activeRecord.step === 'analyzing' && <button type="button" onClick={handleCancel} className="min-h-11 rounded-xl border border-pastel-border text-xs font-black text-pastel-muted">取消分析</button>}
    </div>
  ) : (
    <div className="flex min-w-0 flex-col gap-4"><section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between gap-3"><div><span className="text-[0.68rem] font-black tracking-[0.14em] text-[#ed6d46]">CONFIRMED INPUT</span><h2 className="mt-1 text-lg font-black">{activeRecord.analysis?.productName || '生成电商主图'}</h2></div>{!isBusy && <button type="button" onClick={() => patchActive({ step: 'input', results: [], error: '' })} className="flex min-h-11 items-center gap-2 rounded-xl border border-pastel-border px-3 text-xs font-black text-pastel-muted"><ArrowLeft className="h-4 w-4" />修改输入</button>}</div><div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-pastel-bg p-3"><span className="text-pastel-muted">平台</span><strong className="mt-1 block">{selectedPlatform.label}</strong></div><div className="rounded-xl bg-pastel-bg p-3"><span className="text-pastel-muted">语言</span><strong className="mt-1 block">{selectedLanguage.label}</strong></div><div className="rounded-xl bg-pastel-bg p-3"><span className="text-pastel-muted">比例</span><strong className="mt-1 block">{activeRecord.aspectRatio}</strong></div><div className="rounded-xl bg-pastel-bg p-3"><span className="text-pastel-muted">输出</span><strong className="mt-1 block">{activeRecord.outputCount}张 · {activeRecord.resolution}</strong></div></div></section>{cancelMessage && <p className="text-center text-xs font-bold text-[#d8552e]">{cancelMessage}</p>}</div>
  );

  const confirmationControls = activeRecord.analysis && activeRecord.step === 'confirm' ? (
    <section className="rounded-2xl border border-[#f0d8c9] bg-[#fffaf6] p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-[#17243c]">确认输出参数</h3>
          <p className="mt-1 text-xs leading-5 text-pastel-muted">改选平台后按新平台规则生成；比例和数量可在提交前调整。</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#d8552e]">{selectedImageModel.label} · {activeRecord.resolution}</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-black text-pastel-muted">
          尺寸比例
          <select value={activeRecord.aspectRatio} onChange={(event) => patchActive({ aspectRatio: event.target.value as AspectRatio })} className="mt-1 min-h-12 w-full rounded-xl border border-pastel-border bg-white px-3 text-sm font-black text-pastel-text">
            {ECOMMERCE_RATIOS.map((ratio) => <option key={ratio.id} value={ratio.id}>{ratio.label}</option>)}
          </select>
        </label>
        <div>
          <span className="text-xs font-black text-pastel-muted">生成数量</span>
          <div className="mt-1 grid grid-cols-6 gap-1.5">
            {[1, 2, 3, 4, 5, 6].map((count) => <button key={count} type="button" onClick={() => {
              const imagePlans = [...activeRecord.analysis!.imagePlans];
              while (imagePlans.length < count) imagePlans.push(`生成第 ${imagePlans.length + 1} 张平台化产品主视觉，保持商品身份并使用差异化构图。`);
              patchActive({ outputCount: count });
              patchAnalysis({ imagePlans: imagePlans.slice(0, count) });
            }} className={`min-h-12 rounded-xl border text-xs font-black ${activeRecord.outputCount === count ? 'border-[#ed6d46] bg-[#fff0e8] text-[#d8552e]' : 'border-pastel-border bg-white text-pastel-muted'}`}>{count}</button>)}
          </div>
        </div>
      </div>
    </section>
  ) : null;

  const analysisPanel = activeRecord.analysis && activeRecord.step === 'confirm' ? (
    <>
      {confirmationControls}
    <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c] sm:p-6"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-5 w-5" /></span><div><span className="text-[0.68rem] font-black tracking-[0.14em] text-emerald-600">ANALYSIS READY</span><h2 className="mt-0.5 text-xl font-black">确认生成电商主图方案</h2></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-xs font-black text-pastel-muted">产品名称<input value={activeRecord.analysis.productName} onChange={(event) => patchAnalysis({ productName: event.target.value })} className="mt-1 min-h-12 w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-sm text-pastel-text" /></label><label className="text-xs font-black text-pastel-muted">产品品类<input value={activeRecord.analysis.productCategory} onChange={(event) => patchAnalysis({ productCategory: event.target.value })} className="mt-1 min-h-12 w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-sm text-pastel-text" /></label><div className="rounded-xl bg-pastel-bg p-4 sm:col-span-2"><span className="text-xs font-black text-pastel-muted">产品身份摘要（只读）</span><p className="mt-2 text-sm leading-6">{activeRecord.analysis.productIdentity}</p></div><label className="text-xs font-black text-pastel-muted sm:col-span-2">核心卖点（每行一条）<textarea value={activeRecord.analysis.sellingPoints.join('\n')} onChange={(event) => patchAnalysis({ sellingPoints: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean).slice(0, 6) })} className="mt-1 min-h-24 w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 py-3 text-sm leading-6 text-pastel-text" /></label><label className="text-xs font-black text-pastel-muted">目标平台<select value={activeRecord.platform} onChange={(event) => patchActive({ platform: event.target.value as EcommercePlatformId })} className="mt-1 min-h-12 w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-sm font-bold text-pastel-text">{ECOMMERCE_PLATFORMS.filter((item) => item.id !== 'smart').map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="text-xs font-black text-pastel-muted">目标语言<select value={activeRecord.language} onChange={(event) => patchActive({ language: event.target.value as EcommerceLanguageId })} className="mt-1 min-h-12 w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-sm font-bold text-pastel-text">{ECOMMERCE_LANGUAGES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label></div><div className="mt-4 rounded-xl border border-[#dbe7f3] bg-[#f5f9fd] p-4"><div className="flex items-center gap-2 text-xs font-black text-[#2d6bb1]"><Brain className="h-4 w-4" />平台建议</div><p className="mt-2 text-sm leading-6">{activeRecord.analysis.platformReason}</p><p className="mt-2 text-xs leading-5 text-pastel-muted">{activeRecord.analysis.platformVisualStrategy}</p></div>{activeRecord.language !== 'none' && <div className="mt-5 grid gap-3"><label className="text-xs font-black text-pastel-muted">主标题<input dir={languageById(activeRecord.language).direction} value={activeRecord.analysis.copy.headline} onChange={(event) => patchAnalysis({ copy: { ...activeRecord.analysis!.copy, headline: event.target.value } })} className="mt-1 min-h-12 w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-sm text-pastel-text" /></label><label className="text-xs font-black text-pastel-muted">副标题<input dir={languageById(activeRecord.language).direction} value={activeRecord.analysis.copy.subheadline} onChange={(event) => patchAnalysis({ copy: { ...activeRecord.analysis!.copy, subheadline: event.target.value } })} className="mt-1 min-h-12 w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-sm text-pastel-text" /></label><label className="text-xs font-black text-pastel-muted">利益点标签（用“｜”分隔）<input dir={languageById(activeRecord.language).direction} value={activeRecord.analysis.copy.badges.join('｜')} onChange={(event) => patchAnalysis({ copy: { ...activeRecord.analysis!.copy, badges: event.target.value.split('｜').map((item) => item.trim()).filter(Boolean).slice(0, 3) } })} className="mt-1 min-h-12 w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-sm text-pastel-text" /></label></div>}<div className="mt-5"><span className="text-xs font-black text-pastel-muted">单图规划</span><div className="mt-2 space-y-2">{activeRecord.analysis.imagePlans.map((plan, index) => <label key={index} className="flex gap-3 rounded-xl border border-pastel-border bg-pastel-bg p-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-black text-[#ed6d46]">{index + 1}</span><textarea value={plan} onChange={(event) => patchAnalysis({ imagePlans: activeRecord.analysis!.imagePlans.map((item, itemIndex) => itemIndex === index ? event.target.value : item) })} className="min-h-16 flex-1 resize-y bg-transparent text-xs leading-5 text-pastel-text outline-none" /></label>)}</div></div>{activeRecord.analysis.riskWarnings.length > 0 && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800"><strong className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />生成前注意</strong><ul className="mt-2 list-disc space-y-1 pl-5">{activeRecord.analysis.riskWarnings.map((item) => <li key={item}>{item}</li>)}</ul></div>}<div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><button type="button" onClick={() => patchActive({ step: 'input', error: '' })} className="min-h-12 rounded-xl border border-pastel-border px-5 text-sm font-black text-pastel-muted">返回修改输入</button><button type="button" onClick={() => void runGeneration(activeRecord)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#17243c] px-6 text-sm font-black text-white"><Sparkles className="h-4 w-4 text-[#ff9b67]" />确认方案，生成{activeRecord.outputCount}张</button></div></section>
    </>
  ) : null;

  const resultPanel = activeRecord.step === 'generating' || activeRecord.step === 'complete' ? (
    <section className="flex min-h-[34rem] flex-col rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c] sm:p-5"><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><LayoutTemplate className="h-5 w-5 text-[#ed6d46]" /><h2 className="text-lg font-black">生成电商主图结果</h2><span className="text-xs font-bold text-pastel-muted">{completedCount}/{activeRecord.results.length}</span></div><p className="mt-1 text-xs text-pastel-muted">视觉底图生成后，将在本地精确合成已确认文案。</p></div><div className="flex gap-2">{activeRecord.step === 'generating' && <button type="button" onClick={handleCancel} className="min-h-11 rounded-xl bg-[#17243c] px-4 text-xs font-black text-white">停止全部</button>}{successfulResults.length > 0 && activeRecord.step === 'complete' && <button type="button" onClick={() => successfulResults.forEach((result, index) => result.imageUrl && window.setTimeout(() => downloadImage(result.imageUrl!, index), index * 140))} className="flex min-h-11 items-center gap-2 rounded-xl bg-[#ed6d46] px-4 text-xs font-black text-white"><Download className="h-4 w-4" />全部下载</button>}</div></div><div className="grid grid-cols-1 content-start gap-4 sm:grid-cols-2 xl:grid-cols-3">{activeRecord.results.map((result, index) => <article key={result.id} className="overflow-hidden rounded-2xl border border-pastel-border bg-white shadow-sm"><div className={`relative flex ${resultAspectClass(activeRecord.aspectRatio)} min-h-56 items-center justify-center overflow-hidden bg-[#edf3f8]`}>{result.imageUrl ? <img src={result.imageUrl} alt={`生成电商主图结果${index + 1}`} className="h-full w-full object-contain" /> : result.status === 'error' || result.status === 'cancelled' ? <div className="max-w-xs p-6 text-center"><AlertCircle className="mx-auto h-7 w-7 text-red-400" /><p className="mt-3 text-sm font-bold text-red-600">{result.error || resultStatusLabel(result.status)}</p></div> : <div className="flex flex-col items-center gap-3 p-6 text-center text-[#ed6d46]"><Loader2 className="h-8 w-8 animate-spin" /><span className="text-sm font-black">{resultStatusLabel(result.status)}</span></div>}</div><div className="flex min-h-16 items-center justify-between gap-2 border-t border-pastel-border px-3"><div className="min-w-0"><p className="truncate text-xs font-black">主图方案 {index + 1}</p><p className={`mt-0.5 truncate text-xs ${result.status === 'error' ? 'text-red-500' : 'text-pastel-muted'}`}>{resultStatusLabel(result.status)}</p></div><div className="flex shrink-0 gap-1">{result.imageUrl && <button type="button" onClick={() => setSelectedPreview(result.imageUrl!)} className="flex h-11 w-11 items-center justify-center rounded-lg text-pastel-muted hover:bg-pastel-bg hover:text-[#2d6bb1]" aria-label="放大预览"><Maximize2 className="h-4 w-4" /></button>}<button type="button" onClick={() => void retryOne(result.id)} disabled={activeRecord.step === 'generating'} className="flex h-11 w-11 items-center justify-center rounded-lg text-pastel-muted hover:bg-[#fff2eb] hover:text-[#ed6d46] disabled:opacity-40" aria-label="单张重试"><RefreshCw className={`h-4 w-4 ${isWorkingStatus(result.status) ? 'animate-spin' : ''}`} /></button>{result.imageUrl && <button type="button" onClick={() => downloadImage(result.imageUrl!, index)} className="flex h-11 w-11 items-center justify-center rounded-lg text-pastel-muted hover:bg-emerald-50 hover:text-emerald-600" aria-label="下载"><Download className="h-4 w-4" /></button>}</div></div></article>)}</div>{activeRecord.step === 'complete' && <button type="button" onClick={startNewRecord} className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-pastel-border bg-pastel-bg text-sm font-black hover:border-[#ed6d46] hover:text-[#ed6d46]"><Plus className="h-4 w-4" />新开生成电商主图任务</button>}</section>
  ) : null;

  return (
    <div className="h-full overflow-y-auto bg-[#eef6ff] text-pastel-text dark:bg-[#080a0d]">
      <div className="mx-auto w-full max-w-[105rem] px-3 py-5 sm:px-5 lg:px-8">
        <header className="relative mb-5 overflow-hidden rounded-[1.75rem] border border-[#d9e5f1] bg-white px-4 py-6 shadow-[0_14px_45px_rgba(33,66,104,0.07)] dark:border-white/10 dark:bg-[#11151c] sm:px-7 sm:py-7"><div className="absolute -right-16 -top-24 h-56 w-56 rounded-full border-[2rem] border-[#edf5fd] bg-[#fff2e9] dark:border-white/[0.03] dark:bg-[#ed6d46]/5" /><div className="absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-[#eaf6ef] opacity-70" /><div className="relative text-center"><div className="inline-flex items-center gap-2 text-xs font-black tracking-[0.14em] text-[#6f8199]"><Sparkles className="h-4 w-4 text-[#ed6d46]" />AI平台化主图Agent</div><h1 className="mt-2 text-2xl font-black tracking-tight text-[#142139] dark:text-white sm:text-3xl">生成电商主图</h1><p className="mx-auto mt-2 max-w-3xl text-sm leading-6 text-pastel-muted">从产品身份出发，结合目标平台、语言与风格生成可编辑、可复用的高转化主视觉。</p><WorkflowSteps step={activeRecord.step} /></div></header>
        {!isHistoryOpen && <button type="button" onClick={() => setIsHistoryOpen(true)} className="fixed bottom-5 left-4 z-40 flex min-h-12 items-center gap-2 rounded-full border border-pastel-border bg-white px-4 text-sm font-black shadow-[0_8px_24px_rgba(30,50,80,0.16)] md:left-[16.25rem] lg:left-[17rem]"><PanelLeftOpen className="h-4 w-4 text-[#ed6d46]" />生成记录<span className="rounded-full bg-pastel-bg px-2 py-1 text-xs text-pastel-muted">{records.length}</span></button>}
        {isHistoryOpen && <button type="button" className="fixed inset-0 z-[69] bg-[#10203a]/35 xl:hidden" onClick={() => setIsHistoryOpen(false)} aria-label="关闭生成记录" />}
        <div className={`grid grid-cols-1 gap-5 ${isHistoryOpen ? 'xl:grid-cols-[17rem_minmax(23rem,31rem)_minmax(0,1fr)]' : 'xl:grid-cols-[minmax(23rem,31rem)_minmax(0,1fr)]'}`}>
          {isHistoryOpen && <div className="fixed inset-y-3 left-3 z-[70] w-[min(18rem,calc(100vw-1.5rem))] xl:sticky xl:top-4 xl:z-10 xl:h-[calc(100vh-7rem)] xl:w-auto xl:self-start">{historyPanel}</div>}
          {inputPanel}
          <div className="flex min-w-0 flex-col gap-4">{activeRecord.error && <div className="flex min-h-12 items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{activeRecord.error}</span></div>}{activeRecord.step === 'input' && !activeRecord.analysis && <section className="flex min-h-[34rem] flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#cedbe8] bg-white/75 p-8 text-center"><span className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-[#fff1e8] text-[#ed6d46]"><LayoutTemplate className="h-9 w-9" /></span><h2 className="mt-5 text-xl font-black text-[#17243c]">先理解产品，再选择平台表达</h2><p className="mt-2 max-w-lg text-sm leading-7 text-pastel-muted">Agent会识别商品结构、卖点与目标人群，建立平台构图和文案方案；确认后才生成视觉底图并精确合成文字。</p><div className="mt-6 grid w-full max-w-xl gap-3 sm:grid-cols-3"><div className="rounded-xl bg-white p-3 text-left shadow-sm"><Store className="h-4 w-4 text-[#ed6d46]" /><strong className="mt-2 block text-xs">16个平台风格</strong></div><div className="rounded-xl bg-white p-3 text-left shadow-sm"><Languages className="h-4 w-4 text-[#2d6bb1]" /><strong className="mt-2 block text-xs">24种语言模式</strong></div><div className="rounded-xl bg-white p-3 text-left shadow-sm"><WandSparkles className="h-4 w-4 text-emerald-600" /><strong className="mt-2 block text-xs">可复用风格库</strong></div></div></section>}{activeRecord.step === 'analyzing' && <section className="flex min-h-[34rem] flex-1 flex-col items-center justify-center rounded-2xl border border-pastel-border bg-white p-8 text-center shadow-sm"><div className="relative flex h-24 w-24 items-center justify-center"><span className="absolute inset-0 animate-ping rounded-full bg-[#ed6d46]/10" /><span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[#17243c] text-white"><Loader2 className="h-7 w-7 animate-spin" /></span></div><h2 className="mt-6 text-xl font-black">Agent正在建立平台化方案</h2><p className="mt-2 max-w-md text-sm leading-7 text-pastel-muted">校验商品身份、提取真实卖点、判断平台风格，并规划每张图片的构图与文字安全区。</p></section>}{analysisPanel}{resultPanel}</div>
        </div>
      </div>
      {selectionModal === 'language' && <SelectionModal title="选择目标语言" onClose={() => setSelectionModal(null)}><div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">{ECOMMERCE_LANGUAGES.map((language) => <button key={language.id} type="button" onClick={() => { patchActive({ language: language.id, analysis: null }); setSelectionModal(null); }} className={`relative flex min-h-36 flex-col items-center justify-center rounded-2xl border-2 bg-pastel-bg p-3 transition hover:-translate-y-1 ${activeRecord.language === language.id ? 'border-[#17243c] shadow-lg' : 'border-transparent'}`}><span className="flex h-14 min-w-14 items-center justify-center rounded-2xl border border-white bg-white px-2 text-xl font-black shadow-sm" dir={language.direction}>{language.mark}</span><strong className="mt-3 text-sm">{language.label}</strong>{activeRecord.language === language.id && <CheckCircle2 className="absolute right-2 top-2 h-5 w-5 text-[#17243c]" />}</button>)}</div></SelectionModal>}
      {selectionModal === 'platform' && <SelectionModal title="选择目标平台" onClose={() => setSelectionModal(null)}><div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">{ECOMMERCE_PLATFORMS.map((platform) => <button key={platform.id} type="button" onClick={() => { patchActive({ platform: platform.id, analysis: null }); setSelectionModal(null); }} className={`relative flex min-h-36 flex-col items-center justify-center rounded-2xl border-2 bg-pastel-bg p-3 text-center transition hover:-translate-y-1 ${activeRecord.platform === platform.id ? 'border-[#17243c] shadow-lg' : 'border-transparent'}`}><span className="flex h-14 min-w-14 items-center justify-center rounded-2xl px-2 text-sm font-black text-white shadow-sm" style={{ backgroundColor: platform.accent }}>{platform.mark}</span><strong className="mt-3 text-sm">{platform.label}</strong><small className="mt-1 line-clamp-2 text-[0.65rem] text-pastel-muted">{platform.description}</small>{activeRecord.platform === platform.id && <CheckCircle2 className="absolute right-2 top-2 h-5 w-5 text-[#17243c]" />}</button>)}</div></SelectionModal>}
      {selectionModal === 'ratio' && <SelectionModal title="选择尺寸比例" onClose={() => setSelectionModal(null)}><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{ECOMMERCE_RATIOS.map((ratio) => { const [w, h] = String(ratio.id).split(':').map(Number); const scale = 70 / Math.max(w, h); return <button key={ratio.id} type="button" onClick={() => { patchActive({ aspectRatio: ratio.id }); setSelectionModal(null); }} className={`relative flex min-h-44 flex-col items-center justify-center rounded-2xl border-2 bg-pastel-bg p-4 transition hover:-translate-y-1 ${activeRecord.aspectRatio === ratio.id ? 'border-[#17243c] shadow-lg' : 'border-transparent'}`}><span className="block rounded border-[3px] border-[#7a8492]" style={{ width: Math.max(24, w * scale), height: Math.max(24, h * scale) }} /><strong className="mt-4 text-base">{ratio.label}</strong>{activeRecord.aspectRatio === ratio.id && <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-[#17243c]" />}</button>; })}</div></SelectionModal>}
      {isStyleOpen && <StyleLibraryModal record={activeRecord} customStyles={customStyles} mutationError={styleMutationError} onSelectPreset={(id) => patchActive({ selectedPresetId: id, selectedCustomStyleId: null })} onSelectCustom={(id) => patchActive({ selectedCustomStyleId: id, selectedPresetId: null })} onCreate={createCustomStyle} onRename={renameCustomStyle} onDelete={deleteCustomStyle} onClose={() => setIsStyleOpen(false)} />}
      {selectedPreview && <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 p-4" onClick={() => setSelectedPreview(null)}><button type="button" onClick={() => setSelectedPreview(null)} className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white" aria-label="关闭预览"><X className="h-6 w-6" /></button><img src={selectedPreview} alt="生成电商主图大图预览" className="max-h-[88vh] max-w-full rounded-xl object-contain" /></div>}
    </div>
  );
};

export default EcommerceHeroTab;
