import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Brain,
  CheckCircle2,
  Download,
  Image as ImageIcon,
  Loader2,
  Maximize,
  RefreshCw,
  Scan,
  Sparkles,
  Store,
  Sun,
  Upload,
  UserCircle2,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { generateImageToImage } from '../services/geminiService';
import { compressImage, getErrorMessage, isAbortError } from '../utils/apiHelpers';
import { AspectRatio, ImageResolution } from '../types';
import { convertImageDataUrlFormat, OutputImageFormat } from '../utils/imageFormat';
import { applyColorCorrection, ColorCorrectionMode, extractEdges } from '../utils/imageProcessor';
import { saveGeneratedProject } from '../../services/projectHistoryService';
import { useCancelableGeneration } from '../hooks/useCancelableGeneration';
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
import { Y2K_POSES } from '../constants/y2kPosePresets';
import { SURI_MIRA_POSES } from '../constants/suriMiraPosePresets';

type UploadKind = 'model' | 'product' | 'scene' | 'action' | 'accessory';
type MainReferenceKind = UploadKind | 'overall' | 'color';
type PoseSourceMode = 'random' | 'manual' | 'reference';
type PlatformKey = 'amazon' | 'shein' | 'temu' | 'tmall' | 'independent';
type PoseLibraryKey =
  | 'clothing'
  | 'sleepwear'
  | 'mensShirt'
  | 'mensKnit'
  | 'mensTee'
  | 'mensShorts'
  | 'mensPants'
  | 'swimShorts'
  | 'longDress'
  | 'womensFashion'
  | 'solavibe'
  | 'suriMira'
  | 'y2k';

type PosePreset = {
  id: string;
  name: string;
  prompt: string;
};

type UploadedImage = {
  id: string;
  preview: string;
  base64: string;
  mime: string;
};

type ResultItem = {
  id: string;
  imageUrl: string | null;
  status: 'pending' | 'generating' | 'done' | 'error';
  prompt: string;
  poseLabel: string;
  error?: string;
};

const POSE_LIBRARIES: Array<{ key: PoseLibraryKey; label: string; desc: string; poses: PosePreset[] }> = [
  { key: 'clothing', label: '通用服装动作库', desc: '默认百搭', poses: CLOTHING_POSES },
  { key: 'womensFashion', label: '通用时尚女装', desc: '女装街拍/棚拍', poses: WOMENS_FASHION_POSES },
  { key: 'mensShirt', label: '男士衬衫', desc: '商务/休闲衬衫', poses: MENS_SHIRT_POSES },
  { key: 'mensKnit', label: '男士针织/Polo', desc: '针织衫/Polo', poses: MENS_KNIT_POSES },
  { key: 'mensTee', label: '男士T恤', desc: '基础T恤', poses: MENS_TEE_POSES },
  { key: 'mensShorts', label: '男士短裤', desc: '短裤下装', poses: MENS_SHORTS_POSES },
  { key: 'mensPants', label: '男士长裤', desc: '长裤下装', poses: MENS_PANTS_POSES },
  { key: 'swimShorts', label: '泳裤/沙滩裤', desc: '度假运动', poses: SWIM_SHORTS_POSES },
  { key: 'longDress', label: '长裙/连衣裙', desc: '裙装展示', poses: LONG_DRESS_POSES },
  { key: 'suriMira', label: 'Suri Mira 宫廷法式复古连衣裙', desc: '宫廷/法式复古', poses: SURI_MIRA_POSES },
  { key: 'sleepwear', label: '睡衣/居家', desc: '居家睡衣', poses: SLEEPWEAR_POSES },
  { key: 'solavibe', label: 'Solavibe 大码度假', desc: '度假大码', poses: SOLAVIBE_POSES },
  { key: 'y2k', label: 'Y2K Editorial', desc: 'Denim/Trouser high-fashion', poses: Y2K_POSES },
];

const PLATFORM_STYLES: Array<{ key: PlatformKey; label: string; desc: string; icon: string; prompt: string }> = [
  {
    key: 'amazon',
    label: 'Amazon',
    desc: '纯白背景',
    icon: 'A',
    prompt: 'Amazon ecommerce catalog DNA: clean high-key lighting, pure white or very clean background, product-first composition, premium compliant commercial styling.',
  },
  {
    key: 'shein',
    label: 'SHEIN',
    desc: '潮流街拍',
    icon: '👗',
    prompt: 'SHEIN fashion marketplace DNA: trendy youthful styling, clean but lively fashion composition, flattering model pose, social-commerce energy, polished apparel display.',
  },
  {
    key: 'temu',
    label: 'Temu',
    desc: '高饱和',
    icon: '🧡',
    prompt: 'Temu marketplace DNA: bright high-saturation commercial look, clear product readability, direct conversion-focused fashion image, energetic and eye-catching.',
  },
  {
    key: 'tmall',
    label: '天猫淘宝',
    desc: '高级质感',
    icon: '🏬',
    prompt: 'Tmall/Taobao premium ecommerce DNA: refined lighting, polished texture, elegant commercial model styling, high perceived value and clean visual hierarchy.',
  },
  {
    key: 'independent',
    label: '独立站',
    desc: '品牌感',
    icon: '🛒',
    prompt: 'Independent DTC brand DNA: brand-forward lifestyle fashion photography, tasteful scene design, cohesive styling, premium editorial ecommerce mood.',
  },
];

const ASPECT_OPTIONS = [
  { id: AspectRatio.SQUARE, label: '1:1', desc: '正方形' },
  { id: AspectRatio.PORTRAIT_2_3, label: '2:3', desc: '主图' },
  { id: AspectRatio.PORTRAIT_3_4, label: '3:4', desc: '详情' },
  { id: AspectRatio.PORTRAIT_9_16, label: '9:16', desc: '竖屏' },
  { id: AspectRatio.LANDSCAPE_16_9, label: '16:9', desc: '横幅' },
];

const MODEL_OPTIONS = [
  { id: 'gemini-3.1-flash-image-preview', label: 'Banana 2', desc: '3.1 Flash', icon: <Zap className="h-4 w-4 text-orange-500" /> },
  { id: 'nanobananapro', label: 'Banana Pro', desc: '3.0 Pro', icon: <Zap className="h-4 w-4 text-orange-500" /> },
  { id: 'gpt-image-2', label: 'GPT Image 2', desc: 'Ultra Quality', icon: <Sparkles className="h-4 w-4 text-orange-500" /> },
];

const getLibrary = (key: PoseLibraryKey) => POSE_LIBRARIES.find((item) => item.key === key) || POSE_LIBRARIES[0];
const toApiImage = (image: UploadedImage) => ({ base64: image.base64, mimeType: image.mime });
const getDataUrl = (image: UploadedImage) => `data:${image.mime};base64,${image.base64}`;
const dataUrlToApiImage = (dataUrl: string) => {
  const [header, base64 = ''] = dataUrl.split(',');
  const mimeType = header.match(/^data:(.*?);base64$/)?.[1] || 'image/png';
  return { base64, mimeType };
};
const getResultAspectClass = (ratio: AspectRatio) => {
  if (ratio === AspectRatio.SQUARE) return 'aspect-square';
  if (ratio === AspectRatio.PORTRAIT_2_3) return 'aspect-[2/3]';
  if (ratio === AspectRatio.PORTRAIT_3_4) return 'aspect-[3/4]';
  if (ratio === AspectRatio.PORTRAIT_9_16) return 'aspect-[9/16]';
  if (ratio === AspectRatio.LANDSCAPE_16_9) return 'aspect-video';
  return 'aspect-[3/4]';
};

const shuffle = <T,>(items: T[]) => {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

const POSE_FISSION_DIVERSITY_DIRECTIVE =
  'MANDATORY visible pose diversity: make this a clearly different body pose from Image 1, with a changed leg stance, torso angle, shoulder line, head direction, arm/hand placement, and/or walking/sitting/leaning geometry. Avoid tiny catalog variations. Keep the same model identity, outfit, product details, and scene DNA, but rebuild the body posture as a new fashion pose.';

const buildPrompt = (options: {
  outputNumber: number;
  poseSourceMode: PoseSourceMode;
  poseText: string;
  poseLabel: string;
  hasScene: boolean;
  hasActionReference: boolean;
  hasAccessoryReference: boolean;
  platformStyle: string;
  scenePrompt: string;
  productCategory: string;
  extraNotes: string;
  poseReferenceManifest?: string;
}) => {
  const {
    outputNumber,
    poseSourceMode,
    poseText,
    poseLabel,
    hasScene,
    hasActionReference,
    hasAccessoryReference,
    platformStyle,
    scenePrompt,
    productCategory,
    extraNotes,
    poseReferenceManifest,
  } = options;

  return `
Create ONE photorealistic ecommerce fashion image for model pose fission output #${outputNumber}.

# IMAGE ROUTING
- Image 1 is the OVERALL MODEL REFERENCE and the highest-weight source: it already contains the correct model, worn product, styling, scene, lighting mood, camera feeling, and commercial visual direction.
- Preserve Image 1's person identity, face, hair, skin tone, body proportions, worn product, styling logic, scene identity, lighting mood, color palette, and overall commercial look unless the action directive requires a new pose.
- Optional model identity images after Image 1 may reinforce face/body consistency only.
- Optional product/garment images after Image 1 may reinforce garment structure, silhouette, color, fabric, seams, trim, print, pattern, and fit.
${hasAccessoryReference ? '- Optional accessory/styling reference images define bags, jewelry, hats, shoes, handheld props, and styling add-ons to integrate naturally with Image 1. Use them as matching references only; keep the main outfit and model identity from Image 1.' : ''}
${hasScene ? '- Scene reference images define the background/location identity, lighting mood, materials, and environment cues.' : '- No scene reference is uploaded. Build a clean commercial scene from the text instructions only.'}
${hasActionReference ? `- The uploaded action reference for this output is POSE BLUEPRINT ONLY: copy its pose, crop, camera distance, body angle, gesture, limb placement, subject scale, visible body extent, and framing. Do NOT copy its clothing, face, background, lighting, props, or color palette.
${poseReferenceManifest || ''}` : ''}

# IDENTITY, PRODUCT AND SCENE CONSISTENCY LOCK
- The generated image must look like a same-shoot pose variation of Image 1.
- The generated person must look like the exact same model from Image 1 in every output.
- Do not change face shape, hair, skin tone, body size, age impression, or model identity.
- Preserve the worn product and scene from Image 1 as the primary reference. Do not randomly change location, background style, lighting mood, product color, product structure, styling, or outfit coordination.
- If optional scene references are uploaded, use them only to reinforce or vary the scene direction requested by the user, while keeping the same-shoot plausibility from Image 1.

# POSE DIRECTIVE
Pose source: ${poseSourceMode === 'reference' ? 'uploaded action reference image' : poseLabel}.
Pose instruction: ${poseText}
- ${POSE_FISSION_DIVERSITY_DIRECTIVE}
- The pose change must be obvious at thumbnail size. Preserve garment readability by adapting the clothing naturally onto the new body geometry, not by shrinking the pose change.

# PRODUCT, PLATFORM AND SCENE
- Platform visual DNA: ${platformStyle}
- Product category: ${productCategory || 'fashion apparel'}.
- Scene instruction: ${scenePrompt || 'clean professional ecommerce fashion photography, natural commercial lighting'}.
- Keep the garment naturally worn on the model. No flat-lay, no mannequin, no standalone product shot.
- If accessory/styling references are uploaded, add them only when they look natural for the pose and platform. Keep scale, placement, and material believable; do not let accessories cover important garment details.
- If the scene or pose conflicts with product fidelity, preserve product identity and adapt the garment naturally to the pose.

# USER NOTES
${extraNotes || 'No extra notes.'}

# NEGATIVE
wrong person, identity drift, changed face, changed hair, changed skin tone, changed body shape, copied model-reference background, copied action-reference background, copied action-reference clothing, wrong garment, changed color, changed fabric, missing seams, poorly integrated accessories, oversized accessories, accessories covering garment, extra people, two models, collage, split screen, text, watermark, logo, distorted hands, broken limbs, unnatural anatomy, blurry product details.
`.trim();
};

const UploadCard: React.FC<{
  title: string;
  desc: string;
  icon: React.ReactNode;
  images: UploadedImage[];
  max: number;
  multiple?: boolean;
  onUpload: (files: File[]) => void;
  onRemove: (id: string) => void;
}> = ({ title, desc, icon, images, max, multiple = true, onUpload, onRemove }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isActive, setIsActive] = useState(false);

  const handleFiles = (files?: FileList | null) => {
    if (files) onUpload(Array.from(files));
  };

  useEffect(() => {
    const handleGlobalPaste = (event: ClipboardEvent) => {
      if (!isActive) return;
      const items = event.clipboardData?.items;
      if (!items) return;
      
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            files.push(file);
          }
        }
      }
      if (files.length > 0) {
        event.preventDefault();
        onUpload(files);
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
    };
  }, [isActive, onUpload]);

  return (
    <div className="rounded-2xl border border-pastel-border bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <div className="mt-0.5 text-pastel-highlight">{icon}</div>
          <div>
            <h3 className="text-sm font-bold text-pastel-text">{title}</h3>
            <p className="mt-0.5 text-[10px] leading-relaxed text-pastel-muted">{desc}</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-600">
          {images.length}/{max}
        </span>
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
        onMouseEnter={() => setIsActive(true)}
        onMouseLeave={() => setIsActive(false)}
        onFocus={() => setIsActive(true)}
        onBlur={() => setIsActive(false)}
        tabIndex={0}
        className={`min-h-[6.5rem] cursor-pointer rounded-xl border-2 border-dashed p-3 transition-all outline-none ${
          isDragging || isActive ? 'border-pastel-highlight bg-orange-50/60 ring-2 ring-orange-100 shadow-sm' : 'border-pastel-border bg-pastel-bg/30 hover:border-orange-200'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          className="hidden"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = '';
          }}
        />
        {images.length > 0 ? (
          <div className="grid grid-cols-4 gap-2">
            {images.map((image) => (
              <div key={image.id} className="group relative overflow-hidden rounded-lg border border-pastel-border bg-white">
                <img src={image.preview} alt={title} className="h-20 w-full object-cover" />
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemove(image.id);
                  }}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {images.length < max && (
              <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-pastel-border text-pastel-muted">
                <Upload className="h-4 w-4" />
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-h-[4.75rem] flex-col items-center justify-center text-center">
            <Upload className="mb-1 h-7 w-7 text-pastel-muted" />
            <p className="text-xs font-bold text-pastel-text">
              {isActive ? '粘贴 (Ctrl+V) 或拖拽上传' : '点击、拖拽或粘贴上传'}
            </p>
            <p className="mt-0.5 text-[10px] text-pastel-muted">
              {isActive ? '已激活，可直接 Ctrl+V 粘贴图片' : '支持 JPG / PNG / WebP，支持粘贴'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const ModelPoseFissionTab: React.FC = () => {
  const [overallImages, setOverallImages] = useState<UploadedImage[]>([]);
  const [modelImages, setModelImages] = useState<UploadedImage[]>([]);
  const [productImages, setProductImages] = useState<UploadedImage[]>([]);
  const [sceneImages, setSceneImages] = useState<UploadedImage[]>([]);
  const [actionImages, setActionImages] = useState<UploadedImage[]>([]);
  const [accessoryImages, setAccessoryImages] = useState<UploadedImage[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.PORTRAIT_3_4);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformKey>('shein');
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-image-preview');
  const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.RES_2K);
  const [outputFormat, setOutputFormat] = useState<OutputImageFormat>('png');
  const [colorCorrectionMode, setColorCorrectionMode] = useState<ColorCorrectionMode>('off');
  const [colorReferenceImages, setColorReferenceImages] = useState<UploadedImage[]>([]);
  const [colorCorrectionBlend, setColorCorrectionBlend] = useState(0.85);
  const [poseSourceMode, setPoseSourceMode] = useState<PoseSourceMode>('random');
  const [poseLibraryKey, setPoseLibraryKey] = useState<PoseLibraryKey>('clothing');
  const [selectedPoseId, setSelectedPoseId] = useState('');
  const [generateCount, setGenerateCount] = useState(4);
  const [productCategory, setProductCategory] = useState('');
  const [scenePrompt, setScenePrompt] = useState('');
  const [extraNotes, setExtraNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [regeneratingIndices, setRegeneratingIndices] = useState<number[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const regenerateControllersRef = useRef<Map<number, AbortController>>(new Map());
  const {
    cancelMessage,
    startGenerationTask,
    cancelGenerationTask,
    isCurrentGenerationTask,
    assertCurrentGenerationTask,
    finishGenerationTask,
  } = useCancelableGeneration();

  const activeLibrary = useMemo(() => getLibrary(poseLibraryKey), [poseLibraryKey]);
  const activePlatform = useMemo(() => PLATFORM_STYLES.find((platform) => platform.key === selectedPlatform) || PLATFORM_STYLES[1], [selectedPlatform]);
  const manualPose = activeLibrary.poses.find((pose) => pose.id === selectedPoseId) || activeLibrary.poses[0];
  const effectivePoseMode: PoseSourceMode = actionImages.length > 0 ? 'reference' : poseSourceMode;
  const effectiveGenerateCount = actionImages.length > 0 ? actionImages.length : generateCount;
  const isRegeneratingAny = regeneratingIndices.length > 0;

  const addImages = async (
    files: File[],
    setter: React.Dispatch<React.SetStateAction<UploadedImage[]>>,
    max: number,
    replace = false
  ) => {
    const validFiles = files.filter((file) => file.type.startsWith('image/'));
    const compressed = await Promise.all(
      validFiles.map(async (file) => {
        const data = await compressImage(file, 1800, 0.92);
        return {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          preview: URL.createObjectURL(file),
          base64: data.base64,
          mime: data.mime,
        };
      })
    );
    setter((prev) => [...(replace ? [] : prev), ...compressed].slice(0, max));
    setError('');
  };

  const removeImage = (kind: MainReferenceKind, id: string) => {
    const removeFrom = (setter: React.Dispatch<React.SetStateAction<UploadedImage[]>>) => {
      setter((prev) => {
        const target = prev.find((image) => image.id === id);
        if (target?.preview.startsWith('blob:')) URL.revokeObjectURL(target.preview);
        return prev.filter((image) => image.id !== id);
      });
    };
    if (kind === 'overall') removeFrom(setOverallImages);
    if (kind === 'model') removeFrom(setModelImages);
    if (kind === 'product') removeFrom(setProductImages);
    if (kind === 'scene') removeFrom(setSceneImages);
    if (kind === 'action') removeFrom(setActionImages);
    if (kind === 'accessory') removeFrom(setAccessoryImages);
    if (kind === 'color') removeFrom(setColorReferenceImages);
    setResults([]);
  };

  const getPoseForOutput = (index: number) => {
    if (actionImages.length > 0 && index < actionImages.length) {
      return {
        label: `动作参考图 #${index + 1}`,
        prompt: 'Match the uploaded action reference image exactly for pose, gesture, camera distance, crop boundary, subject scale, body angle, and visible body extent.',
      };
    }
    if (poseSourceMode === 'manual') {
      return {
        label: `${activeLibrary.label} / ${manualPose?.name || '指定动作'}`,
        prompt: manualPose?.prompt || 'professional ecommerce fashion pose',
      };
    }
    const pose = shuffle(activeLibrary.poses)[index % Math.max(activeLibrary.poses.length, 1)] || activeLibrary.poses[0];
    return {
      label: `${activeLibrary.label} / 随机动作 ${pose?.id || index + 1}`,
      prompt: pose?.prompt || 'varied professional ecommerce fashion pose',
    };
  };

  const buildInputsForOutput = async (index: number) => {
    const inputs = [
      ...overallImages.map(toApiImage),
      ...modelImages.map(toApiImage),
      ...productImages.map(toApiImage),
      ...accessoryImages.map(toApiImage),
      ...sceneImages.map(toApiImage),
    ];
    let poseReferenceManifest = '';
    if (actionImages.length > 0 && index < actionImages.length) {
      const actionImage = actionImages[index];
      const actionImageNumber = inputs.length + 1;
      inputs.push(toApiImage(actionImage));
      try {
        const lineart = await extractEdges(getDataUrl(actionImage));
        const lineartImageNumber = inputs.length + 1;
        inputs.push(dataUrlToApiImage(lineart));
        poseReferenceManifest = `[ACTION BLUEPRINT MANIFEST]: Image ${actionImageNumber} is the original action/pose reference. Image ${lineartImageNumber} is its lineart/silhouette companion. Use both ONLY for pose geometry, crop boundary, camera distance, subject scale, visible body extent, gesture, and framing.`;
      } catch (error) {
        console.warn('Failed to extract action reference lineart. Using original pose image only.', error);
        poseReferenceManifest = `[ACTION BLUEPRINT MANIFEST]: Image ${actionImageNumber} is the original action/pose reference. Use it ONLY for pose geometry, crop boundary, camera distance, subject scale, visible body extent, gesture, and framing.`;
      }
    }
    return { inputs, poseReferenceManifest };
  };

  const generateOne = async (index: number, signal?: AbortSignal, plannedPose = getPoseForOutput(index)): Promise<ResultItem> => {
    const pose = plannedPose;
    const hasActionReference = actionImages.length > 0 && index < actionImages.length;
    const { inputs, poseReferenceManifest } = await buildInputsForOutput(index);
    const prompt = buildPrompt({
      outputNumber: index + 1,
      poseSourceMode: hasActionReference ? 'reference' : poseSourceMode,
      poseText: pose.prompt,
      poseLabel: pose.label,
      hasScene: sceneImages.length > 0 || overallImages.length > 0,
      hasActionReference,
      hasAccessoryReference: accessoryImages.length > 0,
      platformStyle: activePlatform.prompt,
      scenePrompt,
      productCategory,
      extraNotes,
      poseReferenceManifest,
    });
    const [imageUrl] = await generateImageToImage(inputs, prompt, {
      aspectRatio,
      resolution,
      modelId: selectedModel,
      workflowHint: hasActionReference ? 'pose-replication-lock' : 'pose-fission',
      hasModelRef: true,
      signal,
    });
    if (!imageUrl) throw new Error('模型未返回图片');
    const correctedImageUrl = await applyColorCorrection(imageUrl, {
      mode: colorCorrectionMode,
      reference: colorReferenceImages[0] ? getDataUrl(colorReferenceImages[0]) : undefined,
      blend: colorCorrectionBlend,
    });
    const formattedImageUrl = await convertImageDataUrlFormat(correctedImageUrl, outputFormat);
    return { id: `${Date.now()}-${index}`, imageUrl: formattedImageUrl, status: 'done', prompt, poseLabel: pose.label };
  };

  const handleRegenerateOne = async (index: number) => {
    if (overallImages.length === 0) {
      setError('Please upload the main model reference image first.');
      return;
    }
    if (regenerateControllersRef.current.has(index)) return;

    const controller = new AbortController();
    regenerateControllersRef.current.set(index, controller);
    const plannedPose = getPoseForOutput(index);
    setError('');
    setRegeneratingIndices((prev) => (prev.includes(index) ? prev : [...prev, index]));
    setResults((prev) => prev.map((item, idx) => (
      idx === index
        ? { ...item, status: 'generating', error: undefined, poseLabel: plannedPose.label }
        : item
    )));

    try {
      const item = await generateOne(index, controller.signal, plannedPose);
      if (controller.signal.aborted) return;
      setResults((prev) => {
        const next = [...prev];
        next[index] = item;
        return next;
      });
    } catch (itemError) {
      if (!isAbortError(itemError)) {
        const message = getErrorMessage(itemError);
        setResults((prev) => {
          const next = [...prev];
          next[index] = { ...(next[index] || { id: `error-${index}`, imageUrl: null, prompt: '', poseLabel: plannedPose.label }), status: 'error', imageUrl: null, error: message };
          return next;
        });
      }
    } finally {
      regenerateControllersRef.current.delete(index);
      setRegeneratingIndices((prev) => prev.filter((item) => item !== index));
    }
  };

  const handleGenerate = async (regenerateIndex?: number) => {
    if (regenerateIndex !== undefined) {
      await handleRegenerateOne(regenerateIndex);
      return;
    }
    if (overallImages.length === 0) {
      setError('请先上传模特整体参考图，用于锁定已换好产品和场景的完整效果。');
      return;
    }
    setError('');
    const { taskId, signal } = startGenerationTask();
    setIsGenerating(true);
    setRegeneratingIndex(regenerateIndex ?? null);
    const total = regenerateIndex !== undefined ? 1 : effectiveGenerateCount;
    const indices = regenerateIndex !== undefined ? [regenerateIndex] : Array.from({ length: total }, (_, index) => index);
    const plannedPoses = new Map(indices.map((index) => [index, getPoseForOutput(index)]));
    if (regenerateIndex === undefined) {
      setResults(Array.from({ length: total }, (_, index) => ({
        id: `pending-${index}`,
        imageUrl: null,
        status: 'pending',
        prompt: '',
        poseLabel: plannedPoses.get(index)?.label || getPoseForOutput(index).label,
      })));
    } else {
      setResults((prev) => prev.map((item, idx) => (idx === regenerateIndex ? { ...item, status: 'generating', error: undefined, poseLabel: plannedPoses.get(idx)?.label || item.poseLabel } : item)));
    }

    const generated: ResultItem[] = [];
    try {
      for (const index of indices) {
        assertCurrentGenerationTask(taskId, signal);
        setStatusMessage(`正在生成第 ${index + 1} 张 / 共 ${regenerateIndex !== undefined ? results.length || 1 : total} 张...`);
        setResults((prev) => prev.map((item, idx) => (idx === index ? { ...item, status: 'generating', poseLabel: plannedPoses.get(index)?.label || item.poseLabel } : item)));
        try {
          const item = await generateOne(index, signal, plannedPoses.get(index));
          assertCurrentGenerationTask(taskId, signal);
          generated.push(item);
          setResults((prev) => {
            const next = [...prev];
            next[index] = item;
            return next;
          });
        } catch (itemError) {
          const message = getErrorMessage(itemError);
          setResults((prev) => {
            const next = [...prev];
            next[index] = { ...(next[index] || { id: `error-${index}`, imageUrl: null, prompt: '', poseLabel: `#${index + 1}` }), status: 'error', imageUrl: null, error: message };
            return next;
          });
          if (regenerateIndex !== undefined) throw itemError;
        }
      }
      assertCurrentGenerationTask(taskId, signal);
      if (generated.length > 0) {
        await saveGeneratedProject({
          type: 'MODEL',
          generated: generated.map((item) => item.imageUrl!).filter(Boolean),
          original: [
            ...overallImages.map(getDataUrl),
            ...modelImages.map(getDataUrl),
            ...productImages.map(getDataUrl),
            ...accessoryImages.map(getDataUrl),
            ...sceneImages.map(getDataUrl),
            ...actionImages.map(getDataUrl),
          ],
          prompt: generated[0].prompt,
          params: {
            subType: 'model_pose_fission',
            referenceMode: 'overall_model_scene_product',
            aspectRatio,
            resolution,
            model: selectedModel,
            platform: activePlatform.label,
            outputFormat,
            poseSourceMode: effectivePoseMode,
            poseLibrary: activeLibrary.label,
            productCategory,
            scenePrompt,
            extraNotes,
          },
          thumbnail: generated[0].imageUrl || undefined,
        });
      }
      setStatusMessage('生成完成');
    } catch (err) {
      if (!isAbortError(err)) {
        setError(getErrorMessage(err));
      }
    } finally {
      if (!isCurrentGenerationTask(taskId)) {
        return;
      }
      finishGenerationTask(taskId);
      setIsGenerating(false);
      setRegeneratingIndex(null);
    }
  };

  const handleCancelGenerate = () => {
    cancelGenerationTask();
    setStatusMessage('已中止生成');
    setIsGenerating(false);
    setRegeneratingIndex(null);
    setResults((prev) => prev.map((item) => (
      item.status === 'generating' || item.status === 'pending'
        ? { ...item, status: item.imageUrl ? 'done' : 'error', error: item.imageUrl ? undefined : '已中止生成' }
        : item
    )));
  };

  const handleDownload = async (img: string, idx: number) => {
    const formattedImage = await convertImageDataUrlFormat(img, outputFormat);
    const link = document.createElement('a');
    link.href = formattedImage;
    link.download = `model-pose-fission-${Date.now()}-${idx + 1}.${outputFormat}`;
    link.click();
  };

  const handleDownloadAll = () => {
    results.filter((item) => item.imageUrl).forEach((item, idx) => {
      setTimeout(() => handleDownload(item.imageUrl!, idx), idx * 250);
    });
  };

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-pastel-bg to-white pb-24 custom-scrollbar">
      <div className="px-4 py-6 text-center">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-pastel-border bg-white px-4 py-1.5 text-xs text-pastel-muted shadow-sm">
          <UserCircle2 className="h-3.5 w-3.5 text-purple-500" />
          AI Agent 模特姿势裂变专家
        </div>
        <h1 className="text-2xl font-bold text-pastel-text">模特姿势裂变 (Model Pose Fission)</h1>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-16 md:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10">
          <div className="space-y-4">
            <section className="rounded-2xl border border-pastel-border bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Scan className="h-4 w-4 text-pastel-highlight" />
                <h3 className="text-sm font-bold text-pastel-text">画幅比例</h3>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {ASPECT_OPTIONS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setAspectRatio(item.id)}
                    className={`flex min-h-[3.25rem] flex-col items-center justify-center rounded-xl border py-2.5 transition-all ${
                      aspectRatio === item.id ? 'border-pastel-highlight bg-orange-50 text-pastel-highlight ring-1 ring-orange-100' : 'border-pastel-border bg-pastel-bg/30 text-pastel-muted hover:border-orange-200'
                    }`}
                  >
                    <span className="text-[11px] font-bold">{item.label}</span>
                    <span className="text-[9px] opacity-60">{item.desc}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-pastel-border bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Store className="h-4 w-4 text-pastel-highlight" />
                <h3 className="text-sm font-bold text-pastel-text">投放平台风格</h3>
                <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] text-orange-600">适配各平台视觉基因</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {PLATFORM_STYLES.map((platform) => (
                  <button
                    key={platform.key}
                    type="button"
                    onClick={() => setSelectedPlatform(platform.key)}
                    className={`flex min-h-[5rem] flex-col items-center justify-center rounded-xl border px-2 py-2 text-center transition-all ${
                      selectedPlatform === platform.key ? 'border-pastel-highlight bg-orange-50 text-pastel-highlight ring-1 ring-orange-100' : 'border-pastel-border bg-pastel-bg/30 text-pastel-muted hover:border-orange-200'
                    }`}
                  >
                    <span className={`mb-1 flex h-5 min-w-5 items-center justify-center rounded text-sm font-black ${platform.key === 'amazon' ? 'bg-pink-500 px-1 text-white' : ''}`}>{platform.icon}</span>
                    <span className={`text-[10px] font-black ${selectedPlatform === platform.key ? 'text-pastel-highlight' : 'text-pastel-text'}`}>{platform.label}</span>
                    <span className="mt-0.5 text-[8px] text-pastel-muted">{platform.desc}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border-2 border-orange-200 bg-white p-1 shadow-sm">
              <UploadCard
                title="模特整体参考图"
                desc="最高权重。上传已穿上产品并换好场景的模特图，后续只裂变动作和构图。"
                icon={<UserCircle2 className="h-4 w-4" />}
                images={overallImages}
                max={1}
                multiple={false}
                onUpload={(files) => addImages(files, setOverallImages, 1, true)}
                onRemove={(id) => removeImage('overall', id)}
              />
            </section>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <UploadCard title="模特图" desc="人物长相、发型、肤色、体型一致性来源" icon={<UserCircle2 className="h-4 w-4" />} images={modelImages} max={1} multiple={false} onUpload={(files) => addImages(files, setModelImages, 1, true)} onRemove={(id) => removeImage('model', id)} />
              <UploadCard title="服装/产品图" desc="服装结构、颜色、面料和版型最高优先级" icon={<ImageIcon className="h-4 w-4" />} images={productImages} max={4} onUpload={(files) => addImages(files, setProductImages, 4)} onRemove={(id) => removeImage('product', id)} />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <UploadCard title="场景参考图" desc="可选。用于锁定背景、地点、光线和氛围" icon={<Sparkles className="h-4 w-4" />} images={sceneImages} max={3} onUpload={(files) => addImages(files, setSceneImages, 3)} onRemove={(id) => removeImage('scene', id)} />
              <UploadCard title="动作参考图" desc="可选。上传后优先按每张参考图裂变" icon={<Wand2 className="h-4 w-4" />} images={actionImages} max={10} onUpload={(files) => { setPoseSourceMode('reference'); addImages(files, setActionImages, 10); }} onRemove={(id) => removeImage('action', id)} />
            </div>

            <UploadCard
              title="配饰参考图（可选）"
              desc="包包 / 首饰 / 帽子 / 道具。上传后会参考主图风格自然加入搭配。"
              icon={<ImageIcon className="h-4 w-4" />}
              images={accessoryImages}
              max={10}
              onUpload={(files) => addImages(files, setAccessoryImages, 10)}
              onRemove={(id) => removeImage('accessory', id)}
            />

            <section className="rounded-2xl border border-pastel-border bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-2">
                  <Brain className="mt-0.5 h-4 w-4 text-purple-500" />
                  <div>
                    <h3 className="text-sm font-bold text-pastel-text">动作库选择</h3>
                    <p className="mt-0.5 text-[10px] text-pastel-muted">动作参考图优先；未上传时使用随机或手动动作库。</p>
                  </div>
                </div>
                <span className="rounded-full border border-purple-100 bg-purple-50 px-2 py-1 text-[10px] font-bold text-purple-700">
                  当前：{effectivePoseMode === 'reference' ? '参考图锁定' : effectivePoseMode === 'manual' ? '手动动作' : '随机动作'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'random' as PoseSourceMode, label: '智能随机动作', desc: '按动作库抽取' },
                  { id: 'manual' as PoseSourceMode, label: '手动指定动作', desc: '固定一个动作' },
                  { id: 'reference' as PoseSourceMode, label: '动作参考图', desc: '上传图优先' },
                ].map((item) => (
                  <button key={item.id} type="button" onClick={() => setPoseSourceMode(item.id)} className={`min-h-[3.5rem] rounded-xl border px-2 py-2 text-center transition-all ${effectivePoseMode === item.id ? 'border-purple-300 bg-purple-50 text-purple-700' : 'border-pastel-border bg-pastel-bg/30 text-pastel-muted hover:border-purple-200'}`}>
                    <div className="text-[11px] font-black">{item.label}</div>
                    <div className="mt-0.5 text-[9px] opacity-70">{item.desc}</div>
                  </button>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-pastel-muted">动作库</label>
                  <select value={poseLibraryKey} onChange={(event) => { setPoseLibraryKey(event.target.value as PoseLibraryKey); setSelectedPoseId(''); }} className="min-h-[2.75rem] w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-orange-100">
                    {POSE_LIBRARIES.map((library) => <option key={library.key} value={library.key}>{library.label} - {library.desc}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-pastel-muted">指定动作</label>
                  <select value={selectedPoseId} onChange={(event) => setSelectedPoseId(event.target.value)} disabled={poseSourceMode !== 'manual'} className="min-h-[2.75rem] w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-xs font-bold outline-none disabled:opacity-60 focus:ring-2 focus:ring-orange-100">
                    <option value="">默认第一个动作</option>
                    {activeLibrary.poses.map((pose) => <option key={pose.id} value={pose.id}>{pose.id}. {pose.name}</option>)}
                  </select>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-pastel-border bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-pastel-highlight" />
                  <h3 className="text-sm font-bold text-pastel-text">高级参数与手动覆写</h3>
                </div>
              </div>

              <div className="mb-5">
                <div className="mb-3 flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-pastel-highlight" />
                  <label className="block text-xs font-bold text-pastel-text">图像模型选择</label>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {MODEL_OPTIONS.map((model) => {
                    const active = selectedModel === model.id;
                    return (
                      <button key={model.id} type="button" onClick={() => setSelectedModel(model.id)} className={`relative flex min-h-[5.25rem] flex-col items-center justify-center rounded-2xl border-2 bg-white p-3 text-center transition-all ${active ? 'border-purple-400 bg-purple-50/50 text-purple-700 ring-1 ring-purple-100 shadow-sm' : 'border-pastel-border text-pastel-text hover:border-purple-200'}`}>
                        <span className="absolute left-3 top-2">{model.icon}</span>
                        <span className={`text-xs font-black ${active ? 'text-purple-700' : 'text-pastel-text'}`}>{model.label}</span>
                        <span className={`mt-1 text-[9px] font-bold ${active ? 'text-purple-600' : 'text-pastel-muted'}`}>{model.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-pastel-muted">产品名称</label>
                  <input placeholder="AI 推断" className="min-h-[2.75rem] w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-xs outline-none focus:ring-2 focus:ring-orange-100" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-pastel-muted">品类</label>
                  <input value={productCategory} onChange={(event) => setProductCategory(event.target.value)} placeholder="AI 推断" className="min-h-[2.75rem] w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-xs outline-none focus:ring-2 focus:ring-orange-100" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-pastel-muted">人群</label>
                  <select className="min-h-[2.75rem] w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-xs outline-none focus:ring-2 focus:ring-orange-100" defaultValue="美国都市女性">
                    <option>美国都市女性</option>
                    <option>美国职场女性</option>
                    <option>美国都市男性</option>
                    <option>美国年轻情侣</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-pastel-muted">卖点</label>
                  <input placeholder="AI 推断" className="min-h-[2.75rem] w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-xs outline-none focus:ring-2 focus:ring-orange-100" />
                </div>
              </div>

              <div className="mt-3">
                <label className="mb-1 block text-[10px] font-bold text-pastel-muted">补充说明</label>
                <textarea value={scenePrompt} onChange={(event) => setScenePrompt(event.target.value)} placeholder="例如：背面展示，全身" className="min-h-[4.75rem] w-full resize-y rounded-xl border border-pastel-border bg-pastel-bg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-orange-100" />
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-pastel-muted">清晰度</label>
                  <select value={resolution} onChange={(event) => setResolution(event.target.value as ImageResolution)} className="min-h-[2.75rem] w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-orange-100">
                    <option value={ImageResolution.RES_1K}>1K</option>
                    <option value={ImageResolution.RES_2K}>2K</option>
                    <option value={ImageResolution.RES_4K}>4K</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-pastel-muted">批量</label>
                  <select value={effectiveGenerateCount} disabled={actionImages.length > 0} onChange={(event) => setGenerateCount(Number(event.target.value))} className="min-h-[2.75rem] w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:border-purple-200 disabled:bg-purple-50 disabled:text-purple-700">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((count) => <option key={count} value={count}>{count}张</option>)}
                  </select>
                  {actionImages.length > 0 && <p className="mt-1 text-[0.68rem] font-semibold text-purple-600">已按 {actionImages.length} 张动作参考图锁定生成数量</p>}
                </div>
              </div>

              <textarea value={extraNotes} onChange={(event) => setExtraNotes(event.target.value)} placeholder="额外风格或禁忌要求，例如不要帽子、手部自然、衣摆完整..." className="mt-3 min-h-[4.75rem] w-full resize-y rounded-xl border border-pastel-border bg-pastel-bg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-orange-100" />
            </section>

            <section className="rounded-2xl border border-pastel-border bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Download className="h-4 w-4 text-pastel-highlight" />
                <h3 className="text-sm font-bold text-pastel-text">输出格式</h3>
                <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] text-orange-600">下载与历史保存格式</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'jpg' as OutputImageFormat, label: 'JPG', desc: '默认' },
                  { id: 'png' as OutputImageFormat, label: 'PNG', desc: '高清' },
                ].map((item) => (
                  <button key={item.id} type="button" onClick={() => setOutputFormat(item.id)} className={`flex min-h-[3.25rem] flex-col items-center justify-center rounded-xl border transition-all ${outputFormat === item.id ? 'border-pastel-highlight bg-orange-50 text-pastel-highlight ring-1 ring-orange-100' : 'border-pastel-border bg-pastel-bg/30 text-pastel-muted hover:border-orange-200'}`}>
                    <span className="text-[11px] font-bold">{item.label}</span>
                    <span className="text-[9px] opacity-60">{item.desc}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-pastel-border bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Sun className="h-4 w-4 text-pastel-highlight" />
                <h3 className="text-sm font-bold text-pastel-text">色彩校准 Color Match</h3>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-600">生成后统一色调</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'off' as ColorCorrectionMode, label: '关闭', desc: '原图输出' },
                  { id: 'match' as ColorCorrectionMode, label: '参考图匹配', desc: '最推荐' },
                  { id: 'autoWhiteBalance' as ColorCorrectionMode, label: '自动白平衡', desc: 'Gray World' },
                  { id: 'redSuppress' as ColorCorrectionMode, label: '压红补青', desc: '偏红修正' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setColorCorrectionMode(item.id)}
                    className={`min-h-[3.25rem] rounded-xl border px-2 py-2 text-center transition-all ${colorCorrectionMode === item.id ? 'border-blue-300 bg-blue-50 text-blue-700 ring-1 ring-blue-100' : 'border-pastel-border bg-pastel-bg/30 text-pastel-muted hover:border-blue-200'}`}
                  >
                    <span className="block text-[11px] font-black">{item.label}</span>
                    <span className="mt-0.5 block text-[9px] opacity-70">{item.desc}</span>
                  </button>
                ))}
              </div>
              {colorCorrectionMode === 'match' && (
                <div className="mt-3">
                  <UploadCard title="标准色参考图" desc="上传白平衡正确、色调满意的图，只用于生成后色彩映射" icon={<ImageIcon className="h-4 w-4" />} images={colorReferenceImages} max={1} multiple={false} onUpload={(files) => addImages(files, setColorReferenceImages, 1, true)} onRemove={(id) => removeImage('color', id)} />
                </div>
              )}
              {colorCorrectionMode !== 'off' && (
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-[10px] font-bold text-pastel-muted">
                    <span>混合度</span>
                    <span>{Math.round(colorCorrectionBlend * 100)}%</span>
                  </div>
                  <input type="range" min="0.3" max="1" step="0.05" value={colorCorrectionBlend} onChange={(event) => setColorCorrectionBlend(Number(event.target.value))} className="w-full accent-blue-500" />
                </div>
              )}
            </section>

            <button type="button" onClick={() => handleGenerate()} disabled={isGenerating || isRegeneratingAny || overallImages.length === 0} className={`flex min-h-[3.75rem] w-full items-center justify-center gap-3 rounded-2xl py-4 font-bold text-white shadow-lg transition-all ${isGenerating || isRegeneratingAny || overallImages.length === 0 ? 'bg-gray-300' : 'bg-gradient-to-r from-orange-500 to-pink-500 hover:scale-[1.01] hover:shadow-orange-500/30'}`}>
              {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
              {isGenerating ? 'Agent 正在裂变...' : '一键生成模特姿势裂变'}
            </button>
            {isGenerating && (
              <button type="button" onClick={handleCancelGenerate} className="flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-gray-950">
                <X className="h-4 w-4" />
                中止生成
              </button>
            )}
            {cancelMessage && !isGenerating && (
              <p className="text-center text-xs font-bold text-orange-600">{cancelMessage}</p>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="relative flex min-h-[40rem] flex-1 flex-col rounded-2xl border border-pastel-border bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-orange-500" />
                  <h3 className="text-lg font-bold text-pastel-text">生成结果</h3>
                </div>
                <div className="flex items-center gap-2">
                  {error && (
                    <div className="flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-3 py-1 text-[10px] font-medium text-red-600">
                      <AlertCircle className="h-3 w-3" />
                      {error}
                    </div>
                  )}
                  {results.some((item) => item.imageUrl) && !isGenerating && (
                    <button type="button" onClick={handleDownloadAll} className="flex min-h-[2rem] items-center gap-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-pink-500 px-3.5 py-1.5 text-xs font-black text-white shadow-md transition-all hover:scale-[1.02]">
                      <Download className="h-3.5 w-3.5" />
                      全部下载
                    </button>
                  )}
                </div>
              </div>

              <div className="relative flex flex-1 flex-col overflow-hidden rounded-2xl border-2 border-dashed border-pastel-border bg-pastel-bg/50">
                {isGenerating && regeneratingIndex === null && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center space-y-5 bg-white/80 backdrop-blur-sm">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full border bg-white text-orange-500 shadow-xl">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                    <div className="text-center">
                      <h4 className="font-bold text-pastel-text">姿势裂变生成中</h4>
                      <p className="mt-1 text-xs text-pastel-muted">{statusMessage || '正在保持人物一致性并生成多姿势结果...'}</p>
                    </div>
                  </div>
                )}

                {results.length > 0 ? (
                  <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] content-start gap-5 overflow-y-auto p-5">
                    {results.map((item, idx) => (
                      <div key={item.id} className="group relative overflow-hidden rounded-2xl border border-white bg-white shadow-xl">
                        <div className={`relative flex ${getResultAspectClass(aspectRatio)} min-h-[16rem] items-center justify-center bg-white`}>
                          {item.status === 'generating' && !item.imageUrl && <div className="flex flex-col items-center gap-2 text-orange-500"><Loader2 className="h-7 w-7 animate-spin" /><span className="text-xs font-bold">生成中...</span></div>}
                          {item.status === 'error' && <div className="p-5 text-center text-xs font-bold text-red-500">{item.error || '生成失败'}</div>}
                          {item.imageUrl && <img src={item.imageUrl} alt={item.poseLabel} className={`h-full w-full object-contain transition-opacity ${item.status === 'generating' ? 'opacity-45' : 'opacity-100'}`} />}
                          {item.status === 'pending' && <div className="text-xs font-bold text-pastel-muted">等待生成</div>}
                          {item.status === 'generating' && item.imageUrl && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/45 text-orange-500 backdrop-blur-[1px]">
                              <Loader2 className="h-7 w-7 animate-spin" />
                              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold shadow-sm">重新生成中...</span>
                            </div>
                          )}
                        </div>
                        <div className="border-t border-pastel-border bg-white px-3 py-2">
                          <div className="truncate text-[10px] font-bold text-pastel-text">{item.poseLabel}</div>
                        </div>
                        {item.imageUrl && item.status !== 'generating' && (
                          <div className="absolute inset-0 flex items-center justify-center gap-3 bg-black/50 opacity-0 backdrop-blur-[2px] transition-opacity group-hover:opacity-100">
                            <button type="button" onClick={() => setSelectedPreview(item.imageUrl)} className="rounded-full bg-white/20 p-3 text-white transition-transform hover:scale-110 hover:bg-white/40"><Maximize className="h-5 w-5" /></button>
                            <button type="button" onClick={() => handleGenerate(idx)} disabled={isGenerating || regeneratingIndices.includes(idx)} className="rounded-full bg-white/20 p-3 text-white transition-transform hover:scale-110 hover:bg-white/40 disabled:opacity-50"><RefreshCw className={`h-5 w-5 ${regeneratingIndices.includes(idx) ? 'animate-spin' : ''}`} /></button>
                            <button type="button" onClick={() => handleDownload(item.imageUrl!, idx)} className="rounded-full bg-white/20 p-3 text-white transition-transform hover:scale-110 hover:bg-white/40"><Download className="h-5 w-5" /></button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center space-y-4 p-8 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white">
                      <ImageIcon className="h-8 w-8 text-pastel-border" />
                    </div>
                    <p className="max-w-[18rem] text-sm text-pastel-muted">上传模特、服装和场景，选择动作来源后，Agent 会生成保持人物长相一致的多姿势图片。</p>
                    <div className="flex items-center gap-2 rounded-full border border-green-100 bg-green-50 px-3 py-1 text-[10px] font-bold text-green-700">
                      <CheckCircle2 className="h-3 w-3" />
                      主图生成流程独立，不会被此功能影响
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedPreview && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4" onClick={() => setSelectedPreview(null)}>
          <div className="relative max-h-[90vh] max-w-5xl overflow-hidden rounded-2xl bg-white" onClick={(event) => event.stopPropagation()}>
            <img src={selectedPreview} alt="预览" className="max-h-[85vh] w-auto object-contain" />
            <button type="button" onClick={() => setSelectedPreview(null)} className="absolute right-4 top-4 rounded-full bg-black/40 p-2 text-white">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelPoseFissionTab;
