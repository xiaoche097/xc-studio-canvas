import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Image as ImageIcon,
  Info,
  Loader2,
  Maximize2,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Shirt,
  Sparkles,
  Upload,
  WandSparkles,
  X,
} from 'lucide-react';
import { generateImageToImage, generateText, compressImage } from '../services/geminiService';
import { AspectRatio, ImageResolution } from '../types';
import { getErrorMessage, isAbortError } from '../utils/apiHelpers';
import { useCancelableGeneration } from '../hooks/useCancelableGeneration';
import { useImagePaste } from '../hooks/useImagePaste';
import {
  convertImageDataUrlFormat,
  getImageDownloadExtension,
  type OutputImageFormat,
} from '../utils/imageFormat';
import { saveGeneratedProject } from '../../services/projectHistoryService';

type UploadKind = 'product' | 'body';
type TryOnStep = 'input' | 'analyzing' | 'confirm' | 'generating' | 'complete';
type ResultStatus = 'pending' | 'submitting' | 'polling' | 'processing' | 'done' | 'error' | 'cancelled';

type ProductCategory =
  | 'earrings' | 'necklace' | 'ring' | 'bracelet' | 'watch' | 'hat' | 'socks'
  | 'shoes' | 'bag' | 'glasses' | 'hair_accessory' | 'brooch' | 'tie'
  | 'top' | 'outerwear' | 'trousers' | 'skirt' | 'dress' | 'set';

type UploadedImage = {
  id: string;
  name: string;
  mime: string;
  base64: string;
  preview: string;
  width?: number;
  height?: number;
};

type TryOnAnalysis = {
  productIdentity: string;
  keyDetails: string[];
  materialColor: string;
  recommendedPlacement: string;
  scaleFit: string;
  occlusionStrategy: string;
  backgroundStrategy: string;
  referencePlans: string[];
  riskWarnings: string[];
};

type TryOnResult = {
  id: string;
  referenceId?: string;
  status: ResultStatus;
  imageUrl?: string;
  prompt: string;
  error?: string;
};

type ReferenceFidelityCheck = {
  pass: boolean;
  personIdentityScore: number;
  poseCompositionScore: number;
  sceneIntegrityScore: number;
  productScaleScore: number;
  corrections: string[];
};

type TryOnRecord = {
  id: string;
  createdAt: number;
  step: TryOnStep;
  productImages: UploadedImage[];
  bodyReferences: UploadedImage[];
  category: ProductCategory;
  outputCount: number;
  extraRequirements: string;
  modelId: string;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
  outputFormat: OutputImageFormat;
  analysis: TryOnAnalysis | null;
  placement: string;
  backgroundStrategy: string;
  results: TryOnResult[];
  error: string;
};

const TUTORIAL_KEY = 'creative.singleItemTryOn.tutorialSeen.v1';
const MAX_PRODUCT_IMAGES = 5;
const MAX_BODY_REFERENCES = 6;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_RECORDS = 20;
const DEFAULT_MODEL_ID = 'gemini-3.1-flash-image-preview';
const ACCEPTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const CATEGORY_OPTIONS: Array<{ id: ProductCategory; label: string; group: '配饰' | '服装' }> = [
  { id: 'earrings', label: '耳环 / 耳饰', group: '配饰' },
  { id: 'necklace', label: '项链', group: '配饰' },
  { id: 'ring', label: '戒指', group: '配饰' },
  { id: 'bracelet', label: '手链', group: '配饰' },
  { id: 'watch', label: '手表', group: '配饰' },
  { id: 'hat', label: '帽子', group: '配饰' },
  { id: 'socks', label: '袜子', group: '配饰' },
  { id: 'shoes', label: '鞋子', group: '配饰' },
  { id: 'bag', label: '包包', group: '配饰' },
  { id: 'glasses', label: '眼镜', group: '配饰' },
  { id: 'hair_accessory', label: '发饰', group: '配饰' },
  { id: 'brooch', label: '胸针 / 徽章 / 别针', group: '配饰' },
  { id: 'tie', label: '领带', group: '配饰' },
  { id: 'top', label: '上衣', group: '服装' },
  { id: 'outerwear', label: '外套', group: '服装' },
  { id: 'trousers', label: '裤装', group: '服装' },
  { id: 'skirt', label: '半身裙', group: '服装' },
  { id: 'dress', label: '连衣裙', group: '服装' },
  { id: 'set', label: '套装', group: '服装' },
];

const CATEGORY_RULES: Record<ProductCategory, string> = {
  earrings: 'Fit the earring to the visible earlobe and piercing point. Preserve pair/single-item logic from the references, metal, stones, clasp and realistic hair/ear occlusion.',
  necklace: 'Drape the necklace naturally around the neck and collarbone. Preserve exact chain length, pendant scale, link structure and skin contact with gravity-aware curves.',
  ring: 'Fit the ring around an anatomically correct finger with realistic scale, finger occlusion, metal reflections and gemstone orientation.',
  bracelet: 'Wrap the bracelet around the wrist with correct clasp, link count cues, gravity, skin contact and sleeve occlusion.',
  watch: 'Fit the exact watch on the wrist. Preserve dial, bezel, crown, strap, buckle and markings; keep believable wrist curvature and reflections.',
  hat: 'Fit the hat to the head circumference. Preserve crown, brim and material while handling hair occlusion and head angle naturally.',
  socks: 'Fit the socks to both visible feet/legs where composition requires a pair. Preserve cuff height, knit, pattern and realistic stretch without changing the legs.',
  shoes: 'Place the footwear on both visible feet where a pair is required. Preserve sole, upper, laces, heel and panel construction with correct ground contact and perspective.',
  bag: 'Integrate the exact bag with a natural carry or wear interaction. Preserve body, strap, hardware and logo; match hand/shoulder contact, gravity and occlusion.',
  glasses: 'Align the eyewear with eyes, nose bridge and ears. Preserve frame shape, lens tint and hardware; keep realistic lens transparency, reflections and facial identity.',
  hair_accessory: 'Attach the hair accessory to a plausible hair region. Preserve exact shape and decoration while matching hair strands, depth and occlusion.',
  brooch: 'Pin the item to an appropriate garment area with realistic scale, fabric contact, folds and cast shadow; preserve all emblem and hardware details.',
  tie: 'Place the tie under the collar with correct knot, center line, length, fabric and gravity. Preserve surrounding shirt and jacket construction.',
  top: 'Replace only the upper-body garment. Preserve exact neckline, sleeves, hem, print, seams and fabric; fit it to the unchanged body with natural folds.',
  outerwear: 'Fit the outerwear as the top layer. Preserve lapels, closure, pockets, sleeves, length and fabric; maintain believable layering and body pose.',
  trousers: 'Replace only the lower-body garment. Preserve waist, rise, leg silhouette, pockets, hems and fabric while keeping anatomy, pose and footwear unchanged.',
  skirt: 'Fit the skirt at the natural waist/hip. Preserve waistband, length, pleats, slit and fabric with believable drape, leg occlusion and motion.',
  dress: 'Fit the complete dress while preserving neckline, sleeves, waist, hem, print and construction. Keep face, hair, body, pose and scene unchanged.',
  set: 'Fit all coordinated pieces as one exact set. Preserve each component, layering, colors, patterns and boundaries without introducing unrelated styling.',
};

const MODEL_OPTIONS = [
  { id: 'gemini-3.1-flash-image-preview', label: 'Banana 2', desc: '快速稳定' },
  { id: 'gemini-3-pro-image-preview', label: 'Banana Pro', desc: '复杂结构' },
  { id: 'gpt-image-2', label: 'GPT Image 2', desc: '高质细节' },
];

const ASPECT_OPTIONS = [
  { id: AspectRatio.SQUARE, label: '1:1' },
  { id: AspectRatio.PORTRAIT_2_3, label: '2:3' },
  { id: AspectRatio.PORTRAIT_3_4, label: '3:4' },
  { id: AspectRatio.PORTRAIT_4_5, label: '4:5' },
  { id: AspectRatio.LANDSCAPE_4_3, label: '4:3' },
  { id: AspectRatio.LANDSCAPE_16_9, label: '16:9' },
];

const STEP_ITEMS: Array<{ id: TryOnStep; label: string }> = [
  { id: 'input', label: '输入' },
  { id: 'analyzing', label: '分析中' },
  { id: 'confirm', label: '确认规划' },
  { id: 'generating', label: '生成中' },
  { id: 'complete', label: '完成' },
];

const toDataUrl = (image: UploadedImage) => `data:${image.mime};base64,${image.base64}`;
const toApiImage = (image: UploadedImage) => ({ base64: image.base64, mimeType: image.mime });
const dataUrlToApiImage = (dataUrl: string) => {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error('无法读取生成结果进行人物一致性质检。');
  return { mimeType: match[1], base64: match[2] };
};
const categoryLabel = (category: ProductCategory) => CATEGORY_OPTIONS.find((item) => item.id === category)?.label || category;
const isWorkingStatus = (status: ResultStatus) => ['pending', 'submitting', 'polling', 'processing'].includes(status);

const createRecord = (): TryOnRecord => ({
  id: crypto.randomUUID(),
  createdAt: Date.now(),
  step: 'input',
  productImages: [],
  bodyReferences: [],
  category: 'earrings',
  outputCount: 1,
  extraRequirements: '',
  modelId: DEFAULT_MODEL_ID,
  aspectRatio: AspectRatio.PORTRAIT_3_4,
  resolution: ImageResolution.RES_2K,
  outputFormat: 'png',
  analysis: null,
  placement: '',
  backgroundStrategy: '',
  results: [],
  error: '',
});

const getStepIndex = (step: TryOnStep) => STEP_ITEMS.findIndex((item) => item.id === step);

const closestAspectRatio = (width: number, height: number): AspectRatio => {
  const ratio = width / Math.max(1, height);
  const candidates = [
    [AspectRatio.SQUARE, 1],
    [AspectRatio.PORTRAIT_2_3, 2 / 3],
    [AspectRatio.PORTRAIT_3_4, 3 / 4],
    [AspectRatio.PORTRAIT_4_5, 4 / 5],
    [AspectRatio.LANDSCAPE_4_3, 4 / 3],
    [AspectRatio.LANDSCAPE_16_9, 16 / 9],
  ] as const;
  return candidates.reduce((best, current) => Math.abs(current[1] - ratio) < Math.abs(best[1] - ratio) ? current : best)[0];
};

const readDimensions = async (file: File) => {
  try {
    const bitmap = await createImageBitmap(file);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  } catch {
    return {};
  }
};

const parseAnalysis = (text: string, bodyCount: number): TryOnAnalysis => {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI 未返回可识别的试穿方案，请重试。');
  let parsed: any;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    throw new Error('试穿方案解析失败，请重试。');
  }
  const required = ['productIdentity', 'materialColor', 'recommendedPlacement', 'scaleFit', 'occlusionStrategy', 'backgroundStrategy'];
  if (required.some((key) => typeof parsed[key] !== 'string' || !parsed[key].trim())) {
    throw new Error('AI 返回的试穿方案不完整，请重试。');
  }
  const normalizeList = (value: unknown) => Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
  const referencePlans = normalizeList(parsed.referencePlans);
  if (bodyCount > 0 && referencePlans.length < bodyCount) {
    throw new Error('AI 未完成全部参考图的试穿规划，请重试。');
  }
  return {
    productIdentity: parsed.productIdentity.trim(),
    keyDetails: normalizeList(parsed.keyDetails),
    materialColor: parsed.materialColor.trim(),
    recommendedPlacement: parsed.recommendedPlacement.trim(),
    scaleFit: parsed.scaleFit.trim(),
    occlusionStrategy: parsed.occlusionStrategy.trim(),
    backgroundStrategy: parsed.backgroundStrategy.trim(),
    referencePlans: referencePlans.slice(0, bodyCount),
    riskWarnings: normalizeList(parsed.riskWarnings),
  };
};

const parseReferenceFidelity = (text: string): ReferenceFidelityCheck => {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('人物一致性质检未返回有效结果。');
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    throw new Error('人物一致性质检结果解析失败。');
  }
  const score = (key: string) => Math.max(0, Math.min(100, Number(parsed[key]) || 0));
  const personIdentityScore = score('personIdentityScore');
  const poseCompositionScore = score('poseCompositionScore');
  const sceneIntegrityScore = score('sceneIntegrityScore');
  const productScaleScore = score('productScaleScore');
  const corrections = Array.isArray(parsed.corrections) ? parsed.corrections.map(String).map((item) => item.trim()).filter(Boolean) : [];
  return {
    pass: parsed.pass === true && personIdentityScore >= 90 && poseCompositionScore >= 92 && sceneIntegrityScore >= 90 && productScaleScore >= 82,
    personIdentityScore,
    poseCompositionScore,
    sceneIntegrityScore,
    productScaleScore,
    corrections,
  };
};

const verifyReferenceFidelity = async (reference: UploadedImage, generatedImage: string, category: ProductCategory) => {
  const response = await generateText(
    [toApiImage(reference), dataUrlToApiImage(generatedImage)],
    `You are a strict virtual try-on reference-fidelity inspector.

IMAGE 1 is the immutable user-provided person/body reference and intended base canvas.
IMAGE 2 is the generated try-on result for category: ${categoryLabel(category)}.

Evaluate only these requirements:
1. The same visible person must remain: identical facial identity when visible, hair, skin tone, body shape and unchanged anatomy.
2. Pose, expression, hands, camera angle, crop, subject position and framing must remain visually identical.
3. Background, existing clothing outside the target wearing region, accessories, lighting, shadows, color temperature and image character must remain unchanged.
4. The added product must use a physically realistic category-appropriate size derived from body landmarks; it must not be enlarged for visibility, float, or sit at the wrong anatomical location.
5. Only the smallest wearing/contact/occlusion region may differ.

Return JSON only:
{"pass":true,"personIdentityScore":0,"poseCompositionScore":0,"sceneIntegrityScore":0,"productScaleScore":0,"corrections":["specific correction if needed"]}`,
    'gemini-3.1-flash-lite-preview',
  );
  return parseReferenceFidelity(response);
};

const buildAnalysisPrompt = (record: TryOnRecord) => {
  const productEnd = record.productImages.length;
  const bodyStart = productEnd + 1;
  const bodyEnd = productEnd + record.bodyReferences.length;
  return `
You are a senior ecommerce virtual try-on planner. Analyze the supplied images before generation.

IMAGE ROUTING
- Images 1-${productEnd} are multiple views/details of ONE identical product SKU, category: ${categoryLabel(record.category)}.
${record.bodyReferences.length ? `- Images ${bodyStart}-${bodyEnd} are ${record.bodyReferences.length} independent person/body/placement references. Create one plan per reference, in the same order.` : '- No person/body reference is supplied. Plan an appropriate adult model, framing and wearing region.'}

USER REQUIREMENTS
${record.extraRequirements.trim() || 'No extra requirements.'}

Analyze exact product identity, construction, material, color, logo/detail locks, anatomical placement, realistic scale, fit, contact, occlusion, lighting and background preservation. Do not invent details hidden in the source.

Return valid JSON only, with no markdown:
{
  "productIdentity":"concise Chinese product identity summary",
  "keyDetails":["Chinese detail lock"],
  "materialColor":"Chinese material and color summary",
  "recommendedPlacement":"Chinese wearing region and placement",
  "scaleFit":"Chinese scale and fit plan",
  "occlusionStrategy":"Chinese contact and occlusion plan",
  "backgroundStrategy":"Chinese background and lighting strategy",
  "referencePlans":["one concise Chinese plan for each supplied body reference"],
  "riskWarnings":["Chinese generation risk or item to verify"]
}
`.trim();
};

const buildGenerationPrompt = (record: TryOnRecord, resultIndex: number, hasBodyReference: boolean, qaCorrection = '') => {
  const analysis = record.analysis!;
  const productStart = hasBodyReference ? 2 : 1;
  const productEnd = productStart + record.productImages.length - 1;
  return `
Create ONE photorealistic in-place ecommerce product try-on edit, variation ${resultIndex + 1}.

# INPUT ROUTING
${hasBodyReference ? `- Image 1 is the IMMUTABLE BASE CANVAS and the exact person/body reference for this output. The output must remain recognizably the same photograph, not a recreation or a similar person.
- Images ${productStart}-${productEnd} are multiple views of ONE identical product SKU and together are the only source of truth for the item being worn.` : `- Images 1-${productEnd} are multiple views of ONE identical product SKU and together are the only source of truth for the product.
- No person reference is supplied. Create one tasteful adult ecommerce model with an anatomically appropriate pose and clear product visibility.`}

# CONFIRMED PLAN
- Category: ${categoryLabel(record.category)}
- Product identity: ${analysis.productIdentity}
- Material and color: ${analysis.materialColor}
- Placement: ${record.placement || analysis.recommendedPlacement}
- Scale and fit: ${analysis.scaleFit}
- Occlusion: ${analysis.occlusionStrategy}
- Background: ${record.backgroundStrategy || analysis.backgroundStrategy}
${analysis.keyDetails.map((item) => `- Product detail lock: ${item}`).join('\n')}
${hasBodyReference && analysis.referencePlans[resultIndex] ? `- This reference plan: ${analysis.referencePlans[resultIndex]}` : ''}

# CATEGORY-SPECIFIC FIT RULE
${CATEGORY_RULES[record.category]}

# ABSOLUTE RULES
- When Image 1 is supplied, edit it in place. Preserve its exact facial identity, expression, hair strands, skin tone, body proportions, anatomy, pose, hands, crop, camera perspective, subject position, background, existing non-target clothing, accessories, lighting, shadows, color grade, noise and photographic character.
- Do not redraw, beautify, reinterpret, relight, re-pose, reframe, zoom, crop, extend or replace the reference person or scene. Keep original imperfections and details.
- Change only the target wearing/contact region and the minimum pixels required for physically natural occlusion. Every unrelated region must remain visually unchanged.
- Preserve exact product silhouette, construction, material, colors, pattern, text/logo and distinctive details across all references.
- Infer product size from real human landmarks and normal dimensions for ${categoryLabel(record.category)}. Do not enlarge the item for visibility. Match real anatomy, perspective, gravity, contact, fabric behavior, reflections, highlights and local cast shadows.
- Never create a collage, comparison layout, product-only packshot, extra person, extra limb, duplicate item, wrong wearing position, mixed product, text or watermark.

${qaCorrection ? `# REQUIRED CORRECTION AFTER REFERENCE QA
The prior result was rejected. Correct all of the following while returning to Image 1 as the immutable base canvas:
${qaCorrection}` : ''}

# USER REQUIREMENTS
${record.extraRequirements.trim() || 'No extra requirements.'}
`.trim();
};

const resultAspectClass = (ratio: AspectRatio) => {
  if (ratio === AspectRatio.SQUARE) return 'aspect-square';
  if (ratio === AspectRatio.PORTRAIT_2_3) return 'aspect-[2/3]';
  if (ratio === AspectRatio.PORTRAIT_4_5) return 'aspect-[4/5]';
  if (ratio === AspectRatio.LANDSCAPE_4_3) return 'aspect-[4/3]';
  if (ratio === AspectRatio.LANDSCAPE_16_9) return 'aspect-video';
  return 'aspect-[3/4]';
};

const statusLabel = (status: ResultStatus) => ({
  pending: '等待提交',
  submitting: '正在提交',
  polling: '排队生成中',
  processing: '正在处理',
  done: '已完成',
  error: '生成失败',
  cancelled: '已取消',
})[status];

const WorkflowSteps: React.FC<{ step: TryOnStep }> = ({ step }) => {
  const activeIndex = getStepIndex(step);
  return (
    <div className="no-scrollbar mt-5 flex max-w-3xl items-center justify-start gap-2 overflow-x-auto pb-1 sm:mx-auto sm:justify-center" aria-label="试穿流程">
      {STEP_ITEMS.map((item, index) => (
        <React.Fragment key={item.id}>
          {index > 0 && <span className={`h-px min-w-5 flex-1 sm:max-w-12 ${index <= activeIndex ? 'bg-[#ed6d46]' : 'bg-slate-200 dark:bg-white/10'}`} />}
          <div className={`flex min-w-fit items-center gap-2 text-xs font-bold ${index <= activeIndex ? 'text-[#16233b] dark:text-white' : 'text-slate-400'}`}>
            <span className={`flex h-8 w-8 items-center justify-center rounded-full border ${index < activeIndex ? 'border-[#ed6d46] bg-[#ed6d46] text-white' : index === activeIndex ? 'border-[#16233b] bg-[#16233b] text-white dark:border-[#ed6d46] dark:bg-[#ed6d46]' : 'border-slate-200 bg-white dark:border-white/10 dark:bg-white/5'}`}>
              {index < activeIndex ? <Check className="h-4 w-4" /> : index + 1}
            </span>
            <span>{item.label}</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};

const TutorialModal: React.FC<{ onClose: () => void; onRemember: () => void }> = ({ onClose, onRemember }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const [example, setExample] = useState<'product' | 'body'>('product');

  useEffect(() => {
    primaryRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((item) => !item.hasAttribute('disabled'));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#13213a]/62 p-3 backdrop-blur-md sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="try-on-tutorial-title" className="no-scrollbar relative max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-[1.75rem] border border-white/70 bg-[#f8fbff] p-4 shadow-[0_32px_90px_rgba(9,24,48,0.32)] sm:p-7 lg:p-9">
        <button type="button" onClick={onClose} className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#e9f0f8] text-[#24334d] transition hover:bg-[#dce7f3] sm:right-5 sm:top-5" aria-label="关闭教程"><X className="h-5 w-5" /></button>
        <span className="inline-flex rounded-full bg-[#16233b] px-3 py-1.5 text-xs font-black tracking-wide text-white">首次使用建议</span>
        <h2 id="try-on-tutorial-title" className="mt-4 pr-12 text-2xl font-black tracking-tight text-[#142139] sm:text-3xl">先准备素材，再开始分析</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#60708a] sm:text-base">同一款商品可上传多个角度；人物或局部参考不是必填，但清晰的佩戴区域能让尺寸、遮挡与光影更准确。</p>

        <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch">
          {[
            { num: '01', title: '商品图资料', text: '上传同一款商品的 1–5 张图片。简单款 1–2 张即可，结构复杂或需要锁定 Logo、五金和纹理时补充侧面与细节。' },
            { num: '02', title: '部位参考（选填）', text: '最多 6 张，可使用完整人物或清晰局部。每张参考图会对应一张结果；不上传时由 AI 自动匹配人物与佩戴区域。' },
            { num: '03', title: '额外要求（选填）', text: '可补充人物风格、背景光线、重点保留细节和禁忌。AI 会先给出方案，确认后才正式生成。' },
          ].map((item, index) => (
            <React.Fragment key={item.num}>
              {index > 0 && <div className="hidden items-center justify-center lg:flex"><span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ccd9e8] bg-white text-[#16233b]">→</span></div>}
              <article className="rounded-2xl border border-[#dbe5f0] bg-white p-5 shadow-[0_12px_35px_rgba(37,65,99,0.06)]">
                <span className="text-xs font-black tracking-[0.18em] text-[#8da0b8]">{item.num}</span>
                <h3 className="mt-4 font-black text-[#192740]">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#61718a]">{item.text}</p>
              </article>
            </React.Fragment>
          ))}
        </div>

        <section className="mt-5 overflow-hidden rounded-2xl border border-[#d7e3ef] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4ebf3] px-4 py-3 sm:px-5">
            <div><span className="text-[0.65rem] font-black tracking-[0.18em] text-[#ed6d46]">案例提示</span><h3 className="mt-0.5 font-black text-[#17243c]">{example === 'product' ? '干净商品图示例' : '清晰部位参考示例'}</h3></div>
            <div className="flex rounded-xl bg-[#edf3f9] p-1">
              <button type="button" onClick={() => setExample('product')} className={`min-h-11 rounded-lg px-3 text-xs font-black ${example === 'product' ? 'bg-[#16233b] text-white shadow-sm' : 'text-[#60708a]'}`}>商品图</button>
              <button type="button" onClick={() => setExample('body')} className={`min-h-11 rounded-lg px-3 text-xs font-black ${example === 'body' ? 'bg-[#16233b] text-white shadow-sm' : 'text-[#60708a]'}`}>部位参考</button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-[10rem_1fr] sm:p-5">
            <img src={example === 'product' ? './creative-covers/try-on-product-guide.webp' : './creative-covers/try-on-body-guide.webp'} alt={example === 'product' ? '干净商品图示例' : '清晰人物颈部参考示例'} className="aspect-square w-full rounded-xl object-cover sm:w-40" />
            <div className="self-center">
              <p className="text-sm leading-6 text-[#61718a]">{example === 'product' ? '背景尽量纯白或浅灰，商品保持完整、少裁切、光线均匀；多个角度必须是同一款商品。' : '佩戴区域清晰、少遮挡、主体明确；全身或局部均可，但需与选择的试穿品类对应。'}</p>
              <div className="mt-3 flex flex-wrap gap-2">{(example === 'product' ? ['轮廓完整', '细节清晰', '颜色准确'] : ['区域清晰', '光线自然', '姿态可信']).map((tag) => <span key={tag} className="rounded-full bg-[#eef4fb] px-3 py-1 text-xs font-bold text-[#61718a]">{tag}</span>)}</div>
            </div>
          </div>
        </section>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="min-h-12 rounded-xl bg-[#edf3f9] px-5 text-sm font-black text-[#61718a] transition hover:bg-[#e2ebf5]">稍后再看</button>
          <button ref={primaryRef} type="button" onClick={onRemember} className="min-h-12 rounded-xl bg-[#16233b] px-6 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#243550]">明白了，开始上传</button>
        </div>
      </div>
    </div>
  );
};

interface UploadZoneProps {
  kind: UploadKind;
  title: string;
  description: string;
  images: UploadedImage[];
  max: number;
  disabled: boolean;
  active: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onActivate: () => void;
  onFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
}

const UploadZone: React.FC<UploadZoneProps> = ({ kind, title, description, images, max, disabled, active, inputRef, onActivate, onFiles, onRemove }) => (
  <section
    className={`rounded-2xl border bg-white p-4 shadow-sm transition sm:p-5 dark:bg-[#121212] ${active ? 'border-[#ed6d46] ring-4 ring-[#ed6d46]/10' : 'border-pastel-border'}`}
    data-upload-kind={kind}
    onPointerEnter={onActivate}
    onFocusCapture={onActivate}
    onClick={onActivate}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf3ff] text-[#2d6bb1] dark:bg-blue-500/10"><ImageIcon className="h-5 w-5" /></span><div><h3 className="text-sm font-black text-pastel-text">{title}</h3><p className="mt-1 text-xs leading-5 text-pastel-muted">{description}</p></div></div>
      <span className="shrink-0 text-xs font-bold text-pastel-muted">{images.length}/{max}</span>
    </div>
    {images.length > 0 && <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">{images.map((image) => <div key={image.id} className="group relative aspect-square overflow-hidden rounded-xl border border-pastel-border bg-pastel-bg"><img src={image.preview} alt={image.name} className="h-full w-full object-cover" /><button type="button" disabled={disabled} onClick={(event) => { event.stopPropagation(); onRemove(image.id); }} className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-full bg-[#16233b]/85 text-white shadow-sm transition hover:bg-red-500" aria-label={`删除${image.name}`}><X className="h-4 w-4" /></button></div>)}</div>}
    {images.length < max && <button type="button" disabled={disabled} onClick={(event) => { event.stopPropagation(); onActivate(); inputRef.current?.click(); }} onDragOver={(event) => { event.preventDefault(); onActivate(); }} onDrop={(event) => { event.preventDefault(); onActivate(); onFiles(Array.from(event.dataTransfer.files)); }} className="mt-4 flex min-h-32 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#ccd9e8] bg-[#f8fbff] px-4 text-center transition hover:border-[#ed6d46] hover:bg-[#fff8f4] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.03]"><Upload className="h-6 w-6 text-[#ed6d46]" /><span className="mt-2 text-sm font-black text-pastel-text">拖拽、点击或 Ctrl+V 粘贴图片</span><span className="mt-1 text-xs text-pastel-muted">JPG / JPEG / PNG / WEBP · 单张 ≤ 10MB</span></button>}
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(event) => { onFiles(Array.from(event.target.files || [])); event.target.value = ''; }} data-kind={kind} />
  </section>
);

const SingleItemTryOnTab: React.FC<{ isActive?: boolean }> = ({ isActive = true }) => {
  const initialRecordRef = useRef<TryOnRecord | null>(null);
  if (!initialRecordRef.current) initialRecordRef.current = createRecord();
  const [records, setRecords] = useState<TryOnRecord[]>([initialRecordRef.current]);
  const [activeRecordId, setActiveRecordId] = useState(initialRecordRef.current.id);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const activeUploadKindRef = useRef<UploadKind>('product');
  const [activeUploadKind, setActiveUploadKind] = useState<UploadKind>('product');
  const productInputRef = useRef<HTMLInputElement>(null);
  const bodyInputRef = useRef<HTMLInputElement>(null);
  const wasActiveRef = useRef(false);
  const {
    cancelMessage,
    startGenerationTask,
    cancelGenerationTask,
    assertCurrentGenerationTask,
    finishGenerationTask,
  } = useCancelableGeneration();

  const activeRecord = records.find((record) => record.id === activeRecordId) || records[0];
  const isBusy = activeRecord?.step === 'analyzing' || activeRecord?.step === 'generating';
  const outputTotal = activeRecord?.bodyReferences.length || activeRecord?.outputCount || 1;

  const updateRecord = useCallback((id: string, updater: (record: TryOnRecord) => TryOnRecord) => {
    setRecords((current) => current.map((record) => record.id === id ? updater(record) : record));
  }, []);

  const patchActive = useCallback((patch: Partial<TryOnRecord>) => {
    updateRecord(activeRecordId, (record) => ({ ...record, ...patch }));
  }, [activeRecordId, updateRecord]);

  useEffect(() => {
    if (isActive && !wasActiveRef.current && localStorage.getItem(TUTORIAL_KEY) !== '1') setShowTutorial(true);
    wasActiveRef.current = isActive;
  }, [isActive]);

  const activateUpload = useCallback((kind: UploadKind) => {
    activeUploadKindRef.current = kind;
    setActiveUploadKind(kind);
  }, []);

  const processFiles = useCallback(async (files: File[], kind: UploadKind) => {
    if (!activeRecord || isBusy) return;
    const max = kind === 'product' ? MAX_PRODUCT_IMAGES : MAX_BODY_REFERENCES;
    const currentImages = kind === 'product' ? activeRecord.productImages : activeRecord.bodyReferences;
    const imageFiles = files.filter((file) => ACCEPTED_MIME_TYPES.has(file.type));
    const accepted = imageFiles.filter((file) => file.size <= MAX_FILE_SIZE).slice(0, Math.max(0, max - currentImages.length));
    if (!accepted.length) {
      const message = imageFiles.some((file) => file.size > MAX_FILE_SIZE) ? '单张图片不能超过 10MB。' : imageFiles.length ? `最多上传 ${max} 张图片。` : '仅支持 JPG、JPEG、PNG 或 WEBP 图片。';
      patchActive({ error: message });
      return;
    }
    try {
      const uploaded = await Promise.all(accepted.map(async (file): Promise<UploadedImage> => {
        const [compressed, dimensions] = await Promise.all([compressImage(file, 2048, 0.94), readDimensions(file)]);
        return { id: crypto.randomUUID(), name: file.name || `粘贴图片-${Date.now()}.png`, mime: compressed.mime, base64: compressed.base64, preview: `data:${compressed.mime};base64,${compressed.base64}`, ...dimensions };
      }));
      updateRecord(activeRecord.id, (record) => {
        const next = [...(kind === 'product' ? record.productImages : record.bodyReferences), ...uploaded].slice(0, max);
        const nextRatio = kind === 'body' && uploaded[0]?.width && uploaded[0]?.height ? closestAspectRatio(uploaded[0].width, uploaded[0].height) : record.aspectRatio;
        return { ...record, [kind === 'product' ? 'productImages' : 'bodyReferences']: next, aspectRatio: nextRatio, analysis: null, results: [], step: 'input', error: imageFiles.length > accepted.length ? `部分图片未加入：最多 ${max} 张，且单张不超过 10MB。` : '' };
      });
    } catch (error) {
      patchActive({ error: getErrorMessage(error) });
    }
  }, [activeRecord, isBusy, patchActive, updateRecord]);

  useImagePaste((files) => void processFiles(files, activeUploadKindRef.current), isActive && !isBusy && activeRecord?.step === 'input');

  const removeImage = (kind: UploadKind, id: string) => {
    updateRecord(activeRecord.id, (record) => ({ ...record, [kind === 'product' ? 'productImages' : 'bodyReferences']: (kind === 'product' ? record.productImages : record.bodyReferences).filter((image) => image.id !== id), analysis: null, results: [], step: 'input', error: '' }));
  };

  const startNewRecord = () => {
    if (isBusy) return;
    const record = createRecord();
    setRecords((current) => [record, ...current].slice(0, MAX_RECORDS));
    setActiveRecordId(record.id);
    setShowAdvanced(false);
    if (window.innerWidth < 1280) setIsHistoryOpen(false);
  };

  const openRecord = (record: TryOnRecord) => {
    if (isBusy) return;
    setActiveRecordId(record.id);
    setShowAdvanced(false);
    if (window.innerWidth < 1280) setIsHistoryOpen(false);
  };

  const removeRecord = (id: string) => {
    if (isBusy) return;
    if (id === activeRecordId) {
      const replacement = createRecord();
      setRecords((current) => [replacement, ...current.filter((record) => record.id !== id)].slice(0, MAX_RECORDS));
      setActiveRecordId(replacement.id);
    } else {
      setRecords((current) => current.filter((record) => record.id !== id));
    }
  };

  const handleAnalyze = async () => {
    if (!activeRecord.productImages.length || isBusy) {
      if (!activeRecord.productImages.length) patchActive({ error: '请至少上传 1 张商品图。' });
      return;
    }
    const recordId = activeRecord.id;
    const snapshot = { ...activeRecord, productImages: [...activeRecord.productImages], bodyReferences: [...activeRecord.bodyReferences] };
    const { taskId, signal } = startGenerationTask();
    updateRecord(recordId, (record) => ({ ...record, step: 'analyzing', error: '', analysis: null, results: [], createdAt: Date.now() }));
    try {
      const text = await generateText([...snapshot.productImages, ...snapshot.bodyReferences].map(toApiImage), buildAnalysisPrompt(snapshot), 'gemini-3.1-flash-lite-preview');
      assertCurrentGenerationTask(taskId, signal);
      const analysis = parseAnalysis(text, snapshot.bodyReferences.length);
      updateRecord(recordId, (record) => ({ ...record, step: 'confirm', analysis, placement: analysis.recommendedPlacement, backgroundStrategy: analysis.backgroundStrategy, error: '' }));
    } catch (error) {
      if (!isAbortError(error)) updateRecord(recordId, (record) => ({ ...record, step: 'input', error: getErrorMessage(error) }));
    } finally {
      finishGenerationTask(taskId);
    }
  };

  const updateResult = useCallback((recordId: string, resultId: string, patch: Partial<TryOnResult>) => {
    updateRecord(recordId, (record) => ({ ...record, results: record.results.map((result) => result.id === resultId ? { ...result, ...patch } : result) }));
  }, [updateRecord]);

  const generateOne = async (record: TryOnRecord, result: TryOnResult, index: number, signal: AbortSignal) => {
    const reference = record.bodyReferences[index];
    const inputs = reference
      ? [toApiImage(reference), ...record.productImages.map(toApiImage)]
      : record.productImages.map(toApiImage);
    let qaCorrection = '';
    let finalPrompt = '';

    for (let attempt = 0; attempt < (reference ? 2 : 1); attempt += 1) {
      finalPrompt = buildGenerationPrompt(record, index, Boolean(reference), qaCorrection);
      updateResult(record.id, result.id, { status: 'submitting', prompt: finalPrompt, error: undefined });
      const [rawImage] = await generateImageToImage(
        inputs,
        finalPrompt,
        {
          aspectRatio: record.aspectRatio,
          resolution: record.resolution,
          modelId: record.modelId,
          workflowHint: 'single-item-try-on',
          hasModelRef: Boolean(reference),
          signal,
          onStatus: (status) => updateResult(record.id, result.id, { status }),
        },
      );
      if (!rawImage) throw new Error('模型未返回图片。');
      updateResult(record.id, result.id, { status: 'processing' });
      const imageUrl = await convertImageDataUrlFormat(rawImage, record.outputFormat);
      if (!reference) return { ...result, status: 'done' as const, prompt: finalPrompt, imageUrl };
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

      const fidelity = await verifyReferenceFidelity(reference, imageUrl, record.category);
      if (fidelity.pass) return { ...result, status: 'done' as const, prompt: finalPrompt, imageUrl };
      qaCorrection = [
        ...fidelity.corrections,
        `人物一致性 ${fidelity.personIdentityScore}/100，必须恢复为Image 1中的同一人物。`,
        `姿势与构图 ${fidelity.poseCompositionScore}/100，必须逐项对齐Image 1。`,
        `背景与光影 ${fidelity.sceneIntegrityScore}/100，禁止重绘非穿戴区域。`,
        `商品尺度 ${fidelity.productScaleScore}/100，必须按真实人体标志校准自然大小。`,
      ].join('\n- ');
    }

    throw new Error('人物参考一致性质检未通过：结果与原人物、姿势、场景或真实商品尺度不一致，请单张重试。');
  };

  const saveRecord = async (record: TryOnRecord, results: TryOnResult[]) => {
    const successful = results.filter((result) => result.status === 'done' && result.imageUrl);
    if (!successful.length) return;
    await saveGeneratedProject({
      type: 'MODEL',
      generated: successful.map((result) => result.imageUrl!),
      original: [...record.productImages, ...record.bodyReferences].map(toDataUrl),
      prompt: successful[0].prompt,
      thumbnail: successful[0].imageUrl,
      params: {
        source: 'Cyzx4/components/SingleItemTryOnTab',
        subType: 'single_item_try_on_batch',
        category: record.category,
        categoryLabel: categoryLabel(record.category),
        model: record.modelId,
        aspectRatio: record.aspectRatio,
        resolution: record.resolution,
        outputFormat: record.outputFormat,
        outputCount: results.length,
        productImageCount: record.productImages.length,
        bodyReferenceCount: record.bodyReferences.length,
        extraRequirements: record.extraRequirements,
        placement: record.placement,
        backgroundStrategy: record.backgroundStrategy,
        analysis: record.analysis,
        resultStates: results.map((result) => ({ id: result.id, referenceId: result.referenceId, status: result.status, error: result.error })),
      },
    });
  };

  const handleGenerate = async () => {
    if (!activeRecord.analysis || isBusy) return;
    const recordId = activeRecord.id;
    const count = activeRecord.bodyReferences.length || activeRecord.outputCount;
    const initialResults: TryOnResult[] = Array.from({ length: count }, (_, index) => ({ id: crypto.randomUUID(), referenceId: activeRecord.bodyReferences[index]?.id, status: 'pending', prompt: '' }));
    const snapshot: TryOnRecord = { ...activeRecord, productImages: [...activeRecord.productImages], bodyReferences: [...activeRecord.bodyReferences], results: initialResults, step: 'generating', error: '' };
    const { taskId, signal } = startGenerationTask();
    updateRecord(recordId, () => snapshot);
    try {
      const settled = await Promise.allSettled(initialResults.map((result, index) =>
        generateOne(snapshot, result, index, signal).catch((error) => {
          updateResult(recordId, result.id, {
            status: isAbortError(error) ? 'cancelled' : 'error',
            error: isAbortError(error) ? '任务已取消' : getErrorMessage(error),
          });
          throw error;
        })
      ));
      assertCurrentGenerationTask(taskId, signal);
      const finalResults = settled.map((outcome, index): TryOnResult => {
        if (outcome.status === 'fulfilled') return outcome.value;
        const error = outcome.reason;
        return { ...initialResults[index], status: isAbortError(error) ? 'cancelled' : 'error', prompt: buildGenerationPrompt(snapshot, index, Boolean(snapshot.bodyReferences[index])), error: isAbortError(error) ? '任务已取消' : getErrorMessage(error) };
      });
      updateRecord(recordId, (record) => ({ ...record, step: 'complete', results: finalResults, error: finalResults.every((item) => item.status !== 'done') ? '本次任务未生成成功，可单张重试。' : '' }));
      await saveRecord(snapshot, finalResults);
    } catch (error) {
      if (!isAbortError(error)) updateRecord(recordId, (record) => ({ ...record, step: 'complete', error: getErrorMessage(error) }));
    } finally {
      finishGenerationTask(taskId);
    }
  };

  const handleCancel = () => {
    cancelGenerationTask('已停止单品试穿任务');
    updateRecord(activeRecord.id, (record) => ({ ...record, step: 'complete', results: record.results.map((result) => isWorkingStatus(result.status) ? { ...result, status: 'cancelled', error: '任务已取消' } : result) }));
  };

  const handleRetryOne = async (resultId: string) => {
    if (isBusy || !activeRecord.analysis) return;
    const index = activeRecord.results.findIndex((result) => result.id === resultId);
    if (index < 0) return;
    const snapshot: TryOnRecord = { ...activeRecord, productImages: [...activeRecord.productImages], bodyReferences: [...activeRecord.bodyReferences], step: 'generating' };
    const result = { ...activeRecord.results[index], status: 'pending' as const, error: undefined };
    const { taskId, signal } = startGenerationTask();
    updateRecord(snapshot.id, (record) => ({ ...record, step: 'generating', error: '', results: record.results.map((item) => item.id === resultId ? result : item) }));
    try {
      const completed = await generateOne(snapshot, result, index, signal);
      assertCurrentGenerationTask(taskId, signal);
      updateRecord(snapshot.id, (record) => {
        const finalResults = record.results.map((item) => item.id === resultId ? completed : item);
        return { ...record, step: 'complete', results: finalResults, error: '' };
      });
      await saveRecord(snapshot, [completed]);
    } catch (error) {
      if (!isAbortError(error)) updateRecord(snapshot.id, (record) => ({ ...record, step: 'complete', results: record.results.map((item) => item.id === resultId ? { ...item, status: 'error', error: getErrorMessage(error) } : item) }));
    } finally {
      finishGenerationTask(taskId);
    }
  };

  const downloadImage = (url: string, index: number) => {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `product-try-on-${index + 1}-${Date.now()}.${getImageDownloadExtension(url, activeRecord.outputFormat)}`;
    anchor.click();
  };

  const successfulResults = useMemo(() => activeRecord?.results.filter((result) => result.status === 'done' && result.imageUrl) || [], [activeRecord?.results]);
  const completedCount = activeRecord?.results.filter((result) => !isWorkingStatus(result.status)).length || 0;

  if (!activeRecord) return null;

  const historyPanel = (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-pastel-border bg-pastel-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2 px-1 py-1"><div><h2 className="font-black text-pastel-text">生成记录</h2><p className="mt-0.5 text-xs text-pastel-muted">当前会话最多保留 20 项</p></div><button type="button" onClick={() => setIsHistoryOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-pastel-border text-pastel-muted hover:border-[#ed6d46] hover:text-[#ed6d46]" aria-label="收起生成记录"><PanelLeftClose className="h-4 w-4" /></button></div>
      <button type="button" onClick={startNewRecord} disabled={isBusy} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#16233b] px-3 text-sm font-black text-white transition hover:bg-[#263752] disabled:opacity-50"><Plus className="h-4 w-4" />新开任务</button>
      <div className="no-scrollbar mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pb-2">{records.map((record) => {
        const done = record.results.filter((result) => result.status === 'done').length;
        const working = record.step === 'analyzing' || record.step === 'generating';
        const cover = record.results.find((result) => result.imageUrl)?.imageUrl || record.productImages[0]?.preview;
        return <article key={record.id} className={`group relative overflow-hidden rounded-xl border bg-pastel-bg/50 transition ${record.id === activeRecordId ? 'border-[#ed6d46] ring-2 ring-[#ed6d46]/10' : 'border-pastel-border hover:border-[#ed6d46]/50'}`}><button type="button" onClick={() => openRecord(record)} disabled={isBusy && record.id !== activeRecordId} className="block w-full text-left disabled:opacity-60"><div className="relative aspect-[4/3] bg-white">{cover ? <img src={cover} alt="任务预览" className="h-full w-full object-cover" /> : <Shirt className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-slate-200" />}<span className={`absolute inset-x-0 bottom-0 flex min-h-9 items-center justify-center gap-2 px-2 text-xs font-black text-white ${working ? 'bg-[#ed6d46]/92' : 'bg-[#16233b]/90'}`}>{working && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{record.step === 'input' ? '编辑中' : working ? record.step === 'analyzing' ? '分析中' : `生成中 ${done}/${record.results.length}` : record.step === 'confirm' ? '待确认方案' : `已完成 ${done} 张`}</span></div><div className="px-3 py-2.5"><p className="truncate text-xs font-black text-pastel-text">{categoryLabel(record.category)}</p><p className="mt-1 text-[0.7rem] text-pastel-muted">{new Date(record.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} · {record.productImages.length || 0} 张商品图</p></div></button>{!working && <button type="button" onClick={() => removeRecord(record.id)} className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-500 shadow transition hover:bg-red-500 hover:text-white sm:opacity-0 sm:group-hover:opacity-100" aria-label="删除任务"><X className="h-3.5 w-3.5" /></button>}</article>;
      })}</div>
    </aside>
  );

  return (
    <div className="no-scrollbar h-full min-h-0 overflow-x-hidden overflow-y-auto bg-[#f1f7ff] text-pastel-text dark:bg-[#07090d]">
      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} onRemember={() => { localStorage.setItem(TUTORIAL_KEY, '1'); setShowTutorial(false); }} />}
      <div className="mx-auto w-full max-w-[100rem] px-3 py-5 sm:px-5 lg:px-8">
        <header className="relative mb-5 overflow-hidden rounded-[1.75rem] border border-[#d9e5f1] bg-white px-4 py-6 shadow-[0_14px_45px_rgba(33,66,104,0.07)] sm:px-7 sm:py-7 dark:border-white/10 dark:bg-[#11151c]">
          <div className="absolute -right-20 -top-24 h-56 w-56 rounded-full border-[2rem] border-[#edf5fd] bg-[#fff4ed] dark:border-white/[0.03] dark:bg-[#ed6d46]/5" />
          <div className="relative text-center"><div className="inline-flex items-center gap-2 text-xs font-black tracking-[0.14em] text-[#6f8199]"><Sparkles className="h-4 w-4 text-[#ed6d46]" />AI 单品试穿</div><h1 className="mt-2 text-2xl font-black tracking-tight text-[#142139] sm:text-3xl dark:text-white">让商品自然进入真实穿搭</h1><p className="mx-auto mt-2 max-w-3xl text-sm leading-6 text-pastel-muted">上传同一款商品的多角度素材，AI 先分析结构与佩戴关系，确认方案后再生成试戴或试穿效果。</p><button type="button" onClick={() => setShowTutorial(true)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-[#d6e2ef] bg-[#f7fbff] px-4 text-xs font-black text-[#415570] transition hover:border-[#ed6d46] hover:text-[#ed6d46] dark:border-white/10 dark:bg-white/5"><Info className="h-4 w-4" />查看素材教程</button><WorkflowSteps step={activeRecord.step} /></div>
        </header>

        {!isHistoryOpen && <button type="button" onClick={() => setIsHistoryOpen(true)} className="fixed bottom-5 left-4 z-40 flex min-h-12 items-center gap-2 rounded-full border border-pastel-border bg-pastel-card px-4 text-sm font-black shadow-[0_8px_24px_rgba(30,50,80,0.16)] xl:left-24"><PanelLeftOpen className="h-4 w-4 text-[#ed6d46]" />生成记录<span className="rounded-full bg-pastel-bg px-2 py-1 text-xs text-pastel-muted">{records.length}</span></button>}
        {isHistoryOpen && <button type="button" className="fixed inset-0 z-[69] bg-[#10203a]/35 xl:hidden" onClick={() => setIsHistoryOpen(false)} aria-label="关闭生成记录" />}

        <div className={`grid grid-cols-1 gap-5 ${isHistoryOpen ? 'xl:grid-cols-[17rem_minmax(24rem,31rem)_minmax(0,1fr)]' : 'xl:grid-cols-[minmax(24rem,31rem)_minmax(0,1fr)]'}`}>
          {isHistoryOpen && <div className="fixed inset-y-3 left-3 z-[70] w-[min(18rem,calc(100vw-1.5rem))] xl:sticky xl:top-4 xl:z-10 xl:h-[calc(100vh-7rem)] xl:w-auto xl:self-start">{historyPanel}</div>}

          <div className="flex min-w-0 flex-col gap-4">
            {activeRecord.step === 'input' || activeRecord.step === 'analyzing' ? <>
              <UploadZone kind="product" title="商品图资料" description="同一款商品至少 1 张、最多 5 张；复杂结构建议补充侧面与细节。" images={activeRecord.productImages} max={MAX_PRODUCT_IMAGES} disabled={isBusy} active={activeUploadKind === 'product'} inputRef={productInputRef} onActivate={() => activateUpload('product')} onFiles={(files) => void processFiles(files, 'product')} onRemove={(id) => removeImage('product', id)} />
              <UploadZone kind="body" title="部位 / 人物参考（选填）" description="完整人物或清晰局部均可，最多 6 张；每张参考对应一张结果。" images={activeRecord.bodyReferences} max={MAX_BODY_REFERENCES} disabled={isBusy} active={activeUploadKind === 'body'} inputRef={bodyInputRef} onActivate={() => activateUpload('body')} onFiles={(files) => void processFiles(files, 'body')} onRemove={(id) => removeImage('body', id)} />
              <section className="rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm sm:p-5"><div className="mb-4 flex items-center gap-2"><WandSparkles className="h-5 w-5 text-[#ed6d46]" /><h3 className="text-sm font-black">试穿设置</h3></div><label className="block text-xs font-bold text-pastel-muted">试穿类型<select value={activeRecord.category} disabled={isBusy} onChange={(event) => patchActive({ category: event.target.value as ProductCategory, analysis: null, results: [] })} className="mt-1 min-h-12 w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-sm font-bold text-pastel-text outline-none focus:border-[#ed6d46]"><optgroup label="配饰">{CATEGORY_OPTIONS.filter((item) => item.group === '配饰').map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</optgroup><optgroup label="服装">{CATEGORY_OPTIONS.filter((item) => item.group === '服装').map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</optgroup></select></label>{activeRecord.bodyReferences.length === 0 && <label className="mt-4 block text-xs font-bold text-pastel-muted">无人物参考时生成数量<div className="mt-2 grid grid-cols-6 gap-2">{[1, 2, 3, 4, 5, 6].map((count) => <button key={count} type="button" disabled={isBusy} onClick={() => patchActive({ outputCount: count })} className={`min-h-11 rounded-xl border text-sm font-black ${activeRecord.outputCount === count ? 'border-[#ed6d46] bg-[#fff2eb] text-[#d8552e]' : 'border-pastel-border bg-pastel-card text-pastel-muted'}`}>{count}</button>)}</div></label>}<label className="mt-4 block text-xs font-bold text-pastel-muted">额外要求（选填）<textarea value={activeRecord.extraRequirements} disabled={isBusy} onChange={(event) => patchActive({ extraRequirements: event.target.value, analysis: null })} className="mt-1 min-h-28 w-full resize-y rounded-xl border border-pastel-border bg-pastel-bg px-3 py-3 text-sm leading-6 text-pastel-text outline-none focus:border-[#ed6d46]" placeholder="例如：高级通勤风，保留人物与背景，只替换外套；重点保持 Logo、五金和面料纹理……" /></label><button type="button" onClick={() => setShowAdvanced((value) => !value)} className="mt-4 flex min-h-11 w-full items-center justify-between rounded-xl border border-pastel-border bg-pastel-bg px-3 text-sm font-black"><span>高级设置</span>{showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>{showAdvanced && <div className="mt-3 space-y-4 rounded-xl border border-pastel-border bg-[#f8fbff] p-3 dark:bg-white/[0.03]"><div><span className="text-xs font-bold text-pastel-muted">生成模型</span><div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">{MODEL_OPTIONS.map((model) => <button key={model.id} type="button" disabled={isBusy} onClick={() => patchActive({ modelId: model.id })} className={`min-h-14 rounded-xl border px-2 text-center ${activeRecord.modelId === model.id ? 'border-[#ed6d46] bg-[#fff2eb] text-[#d8552e]' : 'border-pastel-border bg-white text-pastel-text dark:bg-white/5'}`}><span className="block text-xs font-black">{model.label}</span><span className="mt-0.5 block text-[0.65rem] opacity-65">{model.desc}</span></button>)}</div></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><label className="text-xs font-bold text-pastel-muted">画幅比例<select value={activeRecord.aspectRatio} onChange={(event) => patchActive({ aspectRatio: event.target.value as AspectRatio })} className="mt-1 min-h-11 w-full rounded-xl border border-pastel-border bg-white px-3 text-sm font-bold text-pastel-text dark:bg-[#121212]">{ASPECT_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="text-xs font-bold text-pastel-muted">清晰度<select value={activeRecord.resolution} onChange={(event) => patchActive({ resolution: event.target.value as ImageResolution })} className="mt-1 min-h-11 w-full rounded-xl border border-pastel-border bg-white px-3 text-sm font-bold text-pastel-text dark:bg-[#121212]"><option value={ImageResolution.RES_1K}>1K</option><option value={ImageResolution.RES_2K}>2K</option><option value={ImageResolution.RES_4K}>4K</option></select></label><label className="text-xs font-bold text-pastel-muted">输出格式<select value={activeRecord.outputFormat} onChange={(event) => patchActive({ outputFormat: event.target.value as OutputImageFormat })} className="mt-1 min-h-11 w-full rounded-xl border border-pastel-border bg-white px-3 text-sm font-bold text-pastel-text dark:bg-[#121212]"><option value="png">PNG</option><option value="jpg">JPG</option></select></label></div></div>}</section>
              <button type="button" onClick={() => void handleAnalyze()} disabled={!activeRecord.productImages.length || isBusy} className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#ed6d46] to-[#f28b57] px-5 text-sm font-black text-white shadow-[0_14px_28px_rgba(237,109,70,0.25)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none">{activeRecord.step === 'analyzing' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}{activeRecord.step === 'analyzing' ? '正在分析商品与佩戴关系…' : '分析商品，生成试穿方案'}</button>
            </> : <section className="rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between gap-3"><div><span className="text-xs font-black tracking-[0.14em] text-[#ed6d46]">CONFIRMED INPUT</span><h2 className="mt-1 text-lg font-black">{categoryLabel(activeRecord.category)} · {outputTotal} 张结果</h2></div>{!isBusy && <button type="button" onClick={() => patchActive({ step: 'input', results: [], error: '' })} className="flex min-h-11 items-center gap-2 rounded-xl border border-pastel-border px-3 text-xs font-black text-pastel-muted hover:border-[#ed6d46] hover:text-[#ed6d46]"><ArrowLeft className="h-4 w-4" />修改输入</button>}</div><div className="mt-4 grid grid-cols-2 gap-3 text-xs"><div className="rounded-xl bg-pastel-bg p-3"><span className="text-pastel-muted">商品图</span><strong className="mt-1 block text-base">{activeRecord.productImages.length} 张</strong></div><div className="rounded-xl bg-pastel-bg p-3"><span className="text-pastel-muted">人物参考</span><strong className="mt-1 block text-base">{activeRecord.bodyReferences.length || 'AI 匹配'}</strong></div></div></section>}
            {cancelMessage && <p className="text-center text-sm font-bold text-[#d8552e]">{cancelMessage}</p>}
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {activeRecord.error && <div className="flex min-h-12 items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{activeRecord.error}</span></div>}
            {activeRecord.step === 'input' && !activeRecord.analysis && <section className="flex min-h-[34rem] flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#cedbe8] bg-white/75 p-8 text-center dark:border-white/10 dark:bg-white/[0.03]"><span className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-[#eaf3ff] text-[#2d6bb1] dark:bg-blue-500/10"><Shirt className="h-9 w-9" /></span><h2 className="mt-5 text-xl font-black text-[#17243c] dark:text-white">从商品身份开始，而不是直接猜</h2><p className="mt-2 max-w-lg text-sm leading-7 text-pastel-muted">上传素材并点击分析后，这里会展示产品结构、穿戴位置、尺度与遮挡方案。你确认后，AI 才会开始正式生成。</p></section>}
            {activeRecord.step === 'analyzing' && <section className="flex min-h-[34rem] flex-1 flex-col items-center justify-center overflow-hidden rounded-2xl border border-[#dbe6f0] bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-[#121212]"><div className="relative flex h-24 w-24 items-center justify-center"><span className="absolute inset-0 animate-ping rounded-full bg-[#ed6d46]/10" /><span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[#16233b] text-white"><Loader2 className="h-7 w-7 animate-spin" /></span></div><h2 className="mt-6 text-xl font-black">正在建立试穿规划</h2><p className="mt-2 max-w-md text-sm leading-7 text-pastel-muted">识别同款商品的结构、材质与关键细节，并逐张判断人物参考中的佩戴区域和遮挡关系。</p></section>}
            {activeRecord.analysis && (activeRecord.step === 'confirm') && <section className="rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm sm:p-6"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"><CheckCircle2 className="h-5 w-5" /></span><div><span className="text-xs font-black tracking-[0.14em] text-emerald-600">ANALYSIS READY</span><h2 className="mt-0.5 text-xl font-black">确认试穿方案</h2></div></div><div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="rounded-xl bg-pastel-bg p-4 sm:col-span-2"><span className="text-xs font-black text-pastel-muted">商品身份</span><p className="mt-2 text-sm leading-6">{activeRecord.analysis.productIdentity}</p></div><div className="rounded-xl bg-pastel-bg p-4"><span className="text-xs font-black text-pastel-muted">材质与颜色</span><p className="mt-2 text-sm leading-6">{activeRecord.analysis.materialColor}</p></div><div className="rounded-xl bg-pastel-bg p-4"><span className="text-xs font-black text-pastel-muted">尺度与贴合</span><p className="mt-2 text-sm leading-6">{activeRecord.analysis.scaleFit}</p></div></div>{activeRecord.analysis.keyDetails.length > 0 && <div className="mt-4"><span className="text-xs font-black text-pastel-muted">重点锁定细节</span><div className="mt-2 flex flex-wrap gap-2">{activeRecord.analysis.keyDetails.map((detail) => <span key={detail} className="rounded-full bg-[#eef5fc] px-3 py-1.5 text-xs font-bold text-[#48617f] dark:bg-white/5 dark:text-slate-300">{detail}</span>)}</div></div>}<div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2"><label className="text-xs font-black text-pastel-muted">试穿类型<select value={activeRecord.category} onChange={(event) => patchActive({ category: event.target.value as ProductCategory })} className="mt-1 min-h-12 w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-sm font-bold text-pastel-text">{CATEGORY_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="text-xs font-black text-pastel-muted">输出比例<select value={activeRecord.aspectRatio} onChange={(event) => patchActive({ aspectRatio: event.target.value as AspectRatio })} className="mt-1 min-h-12 w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-sm font-bold text-pastel-text">{ASPECT_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="text-xs font-black text-pastel-muted sm:col-span-2">佩戴 / 穿着部位<input value={activeRecord.placement} onChange={(event) => patchActive({ placement: event.target.value })} className="mt-1 min-h-12 w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-sm text-pastel-text outline-none focus:border-[#ed6d46]" /></label><label className="text-xs font-black text-pastel-muted sm:col-span-2">背景与光线策略<textarea value={activeRecord.backgroundStrategy} onChange={(event) => patchActive({ backgroundStrategy: event.target.value })} className="mt-1 min-h-24 w-full resize-y rounded-xl border border-pastel-border bg-pastel-bg px-3 py-3 text-sm leading-6 text-pastel-text outline-none focus:border-[#ed6d46]" /></label>{activeRecord.bodyReferences.length === 0 && <label className="text-xs font-black text-pastel-muted sm:col-span-2">生成数量<div className="mt-2 grid grid-cols-6 gap-2">{[1, 2, 3, 4, 5, 6].map((count) => <button key={count} type="button" onClick={() => patchActive({ outputCount: count })} className={`min-h-11 rounded-xl border text-sm font-black ${activeRecord.outputCount === count ? 'border-[#ed6d46] bg-[#fff2eb] text-[#d8552e]' : 'border-pastel-border'}`}>{count}</button>)}</div></label>}</div>{activeRecord.analysis.riskWarnings.length > 0 && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"><div className="flex items-center gap-2 font-black"><AlertCircle className="h-4 w-4" />生成前注意</div><ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5">{activeRecord.analysis.riskWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}<div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><button type="button" onClick={() => patchActive({ step: 'input', error: '' })} className="min-h-12 rounded-xl border border-pastel-border px-5 text-sm font-black text-pastel-muted hover:border-[#ed6d46] hover:text-[#ed6d46]">返回修改素材</button><button type="button" onClick={() => void handleGenerate()} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#16233b] px-6 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5"><Sparkles className="h-4 w-4" />确认方案，生成 {outputTotal} 张</button></div></section>}
            {(activeRecord.step === 'generating' || activeRecord.step === 'complete') && <section className="flex min-h-[36rem] flex-1 flex-col rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm sm:p-5"><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-[#ed6d46]" /><h2 className="text-lg font-black">试穿结果</h2><span className="text-xs font-bold text-pastel-muted">{completedCount}/{activeRecord.results.length}</span></div><div className="flex gap-2">{activeRecord.step === 'generating' && <button type="button" onClick={handleCancel} className="flex min-h-11 items-center gap-2 rounded-xl bg-[#16233b] px-4 text-xs font-black text-white"><X className="h-4 w-4" />停止全部</button>}{successfulResults.length > 0 && activeRecord.step === 'complete' && <button type="button" onClick={() => successfulResults.forEach((result, index) => result.imageUrl && window.setTimeout(() => downloadImage(result.imageUrl!, index), index * 150))} className="flex min-h-11 items-center gap-2 rounded-xl bg-[#ed6d46] px-4 text-xs font-black text-white"><Download className="h-4 w-4" />全部下载</button>}</div></div><div className="grid grid-cols-1 content-start gap-4 sm:grid-cols-2">{activeRecord.results.map((result, index) => <article key={result.id} className="overflow-hidden rounded-2xl border border-pastel-border bg-white shadow-sm dark:bg-white/5"><div className={`relative flex ${resultAspectClass(activeRecord.aspectRatio)} min-h-64 items-center justify-center overflow-hidden bg-[#eef4fa] dark:bg-black/20`}>{result.imageUrl ? <img src={result.imageUrl} alt={`单品试穿结果 ${index + 1}`} className={`h-full w-full object-contain ${isWorkingStatus(result.status) ? 'scale-[1.02] blur-[2px] brightness-75' : ''}`} /> : result.status === 'error' || result.status === 'cancelled' ? <div className="max-w-xs p-6 text-center"><AlertCircle className="mx-auto h-7 w-7 text-red-400" /><p className="mt-3 text-sm font-bold text-red-600">{result.error || statusLabel(result.status)}</p></div> : <div className="flex flex-col items-center gap-3 p-6 text-center text-[#ed6d46]"><Loader2 className="h-8 w-8 animate-spin" /><span className="text-sm font-black">{statusLabel(result.status)}</span></div>}{result.imageUrl && isWorkingStatus(result.status) && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#142139]/45 text-white"><Loader2 className="h-8 w-8 animate-spin" /><span className="rounded-full bg-black/25 px-4 py-2 text-xs font-black">重新生成中 · {statusLabel(result.status)}</span></div>}</div><div className="flex min-h-16 items-center justify-between gap-2 border-t border-pastel-border px-3"><div className="min-w-0"><p className="truncate text-xs font-black">方案 {index + 1}</p><p className={`mt-0.5 truncate text-xs ${result.status === 'error' ? 'text-red-500' : 'text-pastel-muted'}`}>{statusLabel(result.status)}</p></div><div className="flex shrink-0 gap-1">{result.imageUrl && <button type="button" onClick={() => setSelectedPreview(result.imageUrl!)} disabled={isWorkingStatus(result.status)} className="flex h-11 w-11 items-center justify-center rounded-lg text-pastel-muted hover:bg-pastel-bg hover:text-[#2d6bb1] disabled:opacity-40" aria-label="预览结果"><Maximize2 className="h-4 w-4" /></button>}<button type="button" onClick={() => void handleRetryOne(result.id)} disabled={activeRecord.step === 'generating'} className="flex h-11 w-11 items-center justify-center rounded-lg text-pastel-muted hover:bg-[#fff2eb] hover:text-[#ed6d46] disabled:opacity-40" aria-label="重新生成"><RefreshCw className={`h-4 w-4 ${isWorkingStatus(result.status) ? 'animate-spin' : ''}`} /></button>{result.imageUrl && <button type="button" onClick={() => downloadImage(result.imageUrl!, index)} disabled={isWorkingStatus(result.status)} className="flex h-11 w-11 items-center justify-center rounded-lg text-pastel-muted hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-40" aria-label="下载结果"><Download className="h-4 w-4" /></button>}</div></div></article>)}</div>{activeRecord.step === 'complete' && <button type="button" onClick={startNewRecord} className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-pastel-border bg-pastel-bg text-sm font-black hover:border-[#ed6d46] hover:text-[#ed6d46]"><Plus className="h-4 w-4" />新开试穿任务</button>}</section>}
          </div>
        </div>
      </div>
      {selectedPreview && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-4" onClick={() => setSelectedPreview(null)}><button type="button" onClick={() => setSelectedPreview(null)} className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white" aria-label="关闭预览"><X className="h-6 w-6" /></button><img src={selectedPreview} alt="单品试穿大图预览" className="max-h-[88vh] max-w-full rounded-xl object-contain" /></div>}
    </div>
  );
};

export default SingleItemTryOnTab;
