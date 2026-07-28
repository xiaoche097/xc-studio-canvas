import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Eraser,
  Eye,
  Image as ImageIcon,
  Loader2,
  Maximize,
  Paintbrush,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
  Undo,
  Upload,
  UserRound,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { generateImageToImage, generateText, compressImage } from '../services/geminiService';
import { getErrorMessage, isAbortError } from '../utils/apiHelpers';
import { AspectRatio, ImageResolution } from '../types';
import { applyColorCorrection, ColorCorrectionMode, compositeInpaintedFaceBack, createModelHeadIdentityCrop, extractEdges, loadCanvasImage } from '../utils/imageProcessor';
import { convertImageDataUrlFormat, getImageDownloadExtension, OutputImageFormat } from '../utils/imageFormat';
import { saveGeneratedProject } from '../../services/projectHistoryService';
import { useCancelableGeneration } from '../hooks/useCancelableGeneration';
import { useImagePaste } from '../hooks/useImagePaste';

// ==================== Types & Interfaces ====================

type UploadKind = 'model' | 'scene';
type OutfitMode = 'auto' | 'source' | 'target';
type GenerationStatus = 'pending' | 'submitting' | 'polling' | 'processing' | 'done' | 'error' | 'cancelled';
type TransferCheckpoint = 'input' | 'analyzed' | 'masked' | 'complete';
export type HDStep = 'input' | 'analyzing' | 'color' | 'line' | 'upscaling' | 'complete';

export type UploadedImage = {
  id: string;
  preview: string;
  base64: string;
  mime: string;
  name: string;
  maskDataUrl?: string; // Optional B&W face mask DataURL
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
  poseAnchor: { base64: string; mimeType: string };
  maskAnchor?: { base64: string; mimeType: string };
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
  targetScenes: UploadedImage[];
  selectedModel: string;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
  outputFormat: OutputImageFormat;
  colorCorrectionMode: ColorCorrectionMode;
  colorCorrectionBlend: number;
  outfitMode: OutfitMode;
  extraNotes: string;
  agentAnalysis: AgentAnalysis | null;
  results: ResultItem[];
  error: string | null;
}

const MAX_RECORDS = 20;
const MODEL_SLOTS = ['正面', '侧面', '微侧'] as const;
const MAX_MODEL_IMAGES = 3;
const MAX_SCENE_IMAGES = 10;

const STEPS: Array<{ id: HDStep; label: string }> = [
  { id: 'input', label: '1. 输入' },
  { id: 'analyzing', label: '2. AI分析' },
  { id: 'color', label: '3. 遮罩确认' },
  { id: 'upscaling', label: '4. 光影融合' },
  { id: 'complete', label: '5. 完成' },
];

const MODEL_OPTIONS = [
  { id: 'gemini-3.1-flash-image-preview', label: 'Banana 2', desc: '3.1 Flash' },
  { id: 'gemini-3-pro-image-preview', label: 'Banana Pro', desc: '3 Pro' },
  { id: 'gpt-image-2', label: 'GPT Image 2', desc: 'Ultra Quality' },
];

const ASPECT_OPTIONS: Array<{ id: AspectRatio; label: string; desc: string }> = [
  { id: AspectRatio.PORTRAIT_2_3, label: '2:3', desc: '电商主图 (默认)' },
  { id: AspectRatio.PORTRAIT_3_4, label: '3:4', desc: '女装常规' },
  { id: AspectRatio.SQUARE, label: '1:1', desc: '正方形' },
  { id: AspectRatio.PORTRAIT_9_16, label: '9:16', desc: '竖屏' },
  { id: AspectRatio.LANDSCAPE_16_9, label: '16:9', desc: '横屏' },
  { id: AspectRatio.LANDSCAPE_21_9, label: '21:9', desc: '超宽屏' },
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

const OUTFIT_OPTIONS: Array<{ id: OutfitMode; label: string; desc: string }> = [
  { id: 'auto', label: 'AI 自动识别', desc: '根据补充要求决定' },
  { id: 'source', label: '迁移源模特服装', desc: '同步衣服、鞋包与配饰' },
  { id: 'target', label: '保留场景服装', desc: '只替换人物身份与外貌' },
];

const DATA_URL_PATTERN = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/;
const getDataUrl = (image: UploadedImage) => `data:${image.mime};base64,${image.base64}`;
const toApiImage = (image: UploadedImage) => ({ base64: image.base64, mimeType: image.mime });
const dataUrlToApiImage = (dataUrl: string) => {
  const match = dataUrl.match(DATA_URL_PATTERN);
  return { base64: match ? match[2] : dataUrl, mimeType: match ? match[1] : 'image/jpeg' };
};

const detectsSourceOutfitRequest = (notes: string) =>
  /(源模特|我的模特|模特图).{0,18}(衣服|服装|穿搭|鞋|包|配饰).{0,12}(换|迁移|保留|同步|复制)|把.{0,12}(衣服|服装|穿搭).{0,12}(换|迁移|放|同步).{0,8}(进去|过去|到场景)|transfer.{0,20}(source|model).{0,12}(outfit|clothes|clothing)/i.test(notes);

const fallbackAnalysis = (notes: string): AgentAnalysis => ({
  identityBrief: 'Lock exact source model face geometry, eyes, nose, lips, jawline, skin tone, hairline, and body frame.',
  lightingBrief: 'Extract key-light direction, ambient contrast, color temperature, and contact shadows from target scene.',
  gazeAndPoseAnalysis: '已精准检测目标场景模特的头部偏转角 (如 3/4 侧脸/侧向视线)，指令将严格复制侧向视线与神情，防止生成僵硬正脸。',
  transferSourceOutfit: detectsSourceOutfitRequest(notes),
  outfitReason: detectsSourceOutfitRequest(notes) ? '用户补充要求提到了迁移源模特服装。' : '未明确要求迁移源模特服装，只进行高精度换脸。',
  lightingQuality: 'perfect',
  lightingAnalysis: '目标场景光影方向清晰，与源模特感光基调良好匹配，适合直接合成生成。',
  faceQuality: 'excellent',
  faceRecommendation: '当前上传的模特参考图清晰度良好，五官轮廓完整，推荐直接生成。',
  isReadyToGenerate: true,
  generatedPrompt: 'High quality commercial fashion photo, replace face with source model, match lighting and color tone.',
});

const buildAgentPrompt = (sourceCount: number, notes: string) => `
You are a fashion model transfer director, head pose specialist, and computer vision lighting analyst.
Analyze source model images 1-${sourceCount} for facial geometry, resolution, angle, and clarity.
Analyze target scene images for:
1. TARGET HEAD ROTATION & GAZE DIRECTION: (e.g. 3/4 side profile, looking off-camera to the left/right, head tilt, candid gaze, SERIOUS/SMILE expression).
2. LIGHT SOURCE DIRECTION, softness, and color temperature.
Determine if source outfit should be transferred based on user notes: "${notes || 'No extra notes'}".

Return valid JSON ONLY (no markdown formatting, no backticks):
{
  "identityBrief": "concise English facial feature and skin tone lock description",
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
  sourceCount: number;
  analysis: AgentAnalysis;
  transferSourceOutfit: boolean;
  hasMask: boolean;
  extraNotes: string;
  sceneNumber: number;
}) => {
  const maskText = options.hasMask
    ? `- INPAINTING FACE SWAP INSTRUCTION: Image 2 is the INPAINTING MASK. The WHITE region in Image 2 covers the target model's face to be replaced. YOU MUST ERASE AND REPLACE ONLY THE FACE inside the WHITE mask region of Image 1 with the source model's face identity from Image 3 & Image 4.`
    : `- Replace target person's face identity in Image 1 completely with the source model from Image 3.`;

  const outfitRules = options.transferSourceOutfit
    ? `# SOURCE OUTFIT TRANSFER\n- Transfer the complete outfit from source model images to target pose.`
    : `# MANDATORY TARGET OUTFIT, BODY POSE & BACKGROUND LOCK (CRITICAL PRIORITY #1)\n- Image 1 is the MANDATORY BASE CANVAS. STRICTLY KEEP Image 1's clothing, green wrap blazer jacket, cut, trousers, body posture, hands, leaning pole, asphalt zebra crossing, and environment 100% UNCHANGED.\n- DO NOT copy or borrow clothing, inner t-shirts, tops, or necklaces from Image 3 or Image 4! Image 3 & Image 4 are strictly for FACE IDENTITY REFERENCE ONLY.`;

  return `
# COMMERCIAL HIGH-PRECISION FASHION MODEL FACE SWAP

# INPUT IMAGES REFERENCE:
- Image 1: TARGET SCENE BASE IMAGE (MANDATORY BASE: Lock 100% of this image's clothing, green wrap jacket style, dark trousers, body posture, leaning pole, zebra crossing background, and lighting environment).
${options.hasMask ? '- Image 2: FACE INPAINTING MASK (WHITE = target face region to replace; BLACK = 100% keep background & clothing)' : ''}
- Image 3: SOURCE MODEL FACE IDENTITY ANCHOR (HIGHEST PRIORITY FOR FACE LOOK: Lock facial features, eyes, nose, mouth, skin tone, and hair structure).
- Image 4+: Additional Source Model Identity References.

${outfitRules}

# HIGHEST PRIORITY RULE: SOURCE MODEL FACE REPLACEMENT
- The face generated inside the WHITE mask region MUST 100% BE THE SAMPLE MODEL FACE from Image 3!
- Accurately transfer her exact eyes, eyebrows, nose, lip shape, cheekbones, skin texture, and identity into the target head position on Image 1.

# MANDATORY HEAD POSE, GAZE DIRECTION & EXPRESSION LOCK:
- DO NOT generate a camera-staring front-facing head if the target scene model in Image 1 is turned sideways or looking away!
- STRICTLY COPY AND PRESERVE the exact 3/4 profile head rotation angle, tilt, pitch, and eye gaze direction from Image 1 (Target Scene).
- Lock and replicate the authentic facial expression (lip seal/parting, eyebrow tension, natural gaze) from Image 1.

# LIGHTING & COMPOSITION INTEGRATION
- ${options.analysis.lightingBrief}
- Match key light direction, highlight softness, skin tone temperature, and cast shadows to Image 1.

# USER NOTES
${options.extraNotes || 'No extra notes.'}

# REJECT
blended original target face, target face leakage, unreplaced face, mismatched skin tone, red cast, floating face, unrealistic neck seam, distorted face, dual faces, changed clothes when target outfit preservation is requested.
`.trim();
};

type FaceDetectionResult = {
  centerX: number; // percentage 0 - 100
  centerY: number; // percentage 0 - 100
  radiusX: number; // percentage 0 - 100
  radiusY: number; // percentage 0 - 100
};

const detectFaceWithAgent = async (apiImage: { base64: string; mimeType: string }): Promise<FaceDetectionResult> => {
  const prompt = `
You are a computer vision face detection system for face swapping masks.
Analyze the image and locate the main person's face and head.
Output normalized coordinates (0 to 100 percent of image dimensions):
- "centerX": center X position of the face & head (0=left edge, 100=right edge)
- "centerY": center Y position of the face & head (0=top edge, 100=bottom edge)
- "radiusX": half-width of the oval mask covering face and hair (typically 6 to 12)
- "radiusY": half-height of the oval mask covering forehead to chin (typically 7 to 15)

CRITICAL INSTRUCTIONS:
- Pay close attention to the person's actual head and face position in the photo.
- Ignore background roads, asphalt, buildings, or sky.

Return ONLY a raw JSON object with NO markdown formatting, NO backticks:
{"centerX": 50, "centerY": 15, "radiusX": 8, "radiusY": 10}
`.trim();

  try {
    const text = await generateText([apiImage], prompt);
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (
        typeof parsed.centerX === 'number' &&
        typeof parsed.centerY === 'number' &&
        typeof parsed.radiusX === 'number' &&
        typeof parsed.radiusY === 'number'
      ) {
        return {
          centerX: Math.max(5, Math.min(95, parsed.centerX)),
          centerY: Math.max(5, Math.min(95, parsed.centerY)),
          radiusX: Math.max(4, Math.min(25, parsed.radiusX)),
          radiusY: Math.max(4, Math.min(30, parsed.radiusY)),
        };
      }
    }
  } catch (err) {
    console.warn('AI Agent face detection error, falling back to top-center bounds', err);
  }

  return { centerX: 50, centerY: 16, radiusX: 8, radiusY: 10 };
};

const detectAndCreateFaceMaskDataUrl = async (
  image: UploadedImage
): Promise<string> => {
  const apiImg = toApiImage(image);
  const faceCoords = await detectFaceWithAgent(apiImg);

  let targetWidth = 1024;
  let targetHeight = 1024;
  try {
    const img = await loadCanvasImage(getDataUrl(image));
    targetWidth = img.naturalWidth || img.width || 1024;
    targetHeight = img.naturalHeight || img.height || 1024;
  } catch (err) {
    console.warn('Could not load image dimensions for face mask canvas:', err);
  }

  const cx = (faceCoords.centerX / 100) * targetWidth;
  const cy = (faceCoords.centerY / 100) * targetHeight;
  const rx = (faceCoords.radiusX / 100) * targetWidth;
  const ry = (faceCoords.radiusY / 100) * targetHeight;

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
  ctx.fill();

  return canvas.toDataURL('image/png');
};

const createRecord = (): ModelTransferRecord => ({
  id: crypto.randomUUID(),
  createdAt: Date.now(),
  step: 'input',
  checkpoint: 'input',
  oneClick: false,
  sourceModels: [],
  targetScenes: [],
  selectedModel: MODEL_OPTIONS[0].id,
  aspectRatio: AspectRatio.PORTRAIT_2_3,
  resolution: ImageResolution.RES_2K,
  outputFormat: 'png',
  colorCorrectionMode: 'match',
  colorCorrectionBlend: 0.55,
  outfitMode: 'auto',
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

// ==================== Interactive Face Masking Canvas Modal ====================

const FaceMaskModal: React.FC<{
  image: UploadedImage;
  initialBrushSize?: number;
  initialBrushOpacity?: number;
  onBrushSettingsChange?: (size: number, opacity: number) => void;
  onSave: (maskDataUrl: string) => void;
  onClose: () => void;
}> = ({
  image,
  initialBrushSize = 35,
  initialBrushOpacity = 1.0,
  onBrushSettingsChange,
  onSave,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const [brushSize, setBrushSize] = useState<number>(initialBrushSize);
  const [brushOpacity, setBrushOpacity] = useState<number>(initialBrushOpacity);
  const [mode, setMode] = useState<'paint' | 'erase'>('paint');
  const [history, setHistory] = useState<ImageData[]>([]);
  const [imgLoaded, setImgLoaded] = useState(false);

  const [isAnalyzingFace, setIsAnalyzingFace] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = getDataUrl(image);
    img.onload = () => {
      if (!isMounted) return;
      imgRef.current = img;

      const canvas = canvasRef.current;
      if (!canvas) {
        setImgLoaded(true);
        return;
      }
      canvas.width = img.naturalWidth || 1024;
      canvas.height = img.naturalHeight || 1024;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setImgLoaded(true);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (image.maskDataUrl) {
        const maskImg = new Image();
        maskImg.src = image.maskDataUrl;
        maskImg.onload = () => {
          if (!isMounted) return;
          ctx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
          saveState();
          setImgLoaded(true);
        };
        maskImg.onerror = () => {
          if (isMounted) setImgLoaded(true);
        };
      } else {
        setIsAnalyzingFace(true);
        detectAndCreateFaceMaskDataUrl(image).then((dataUrl) => {
          if (!isMounted) return;
          const maskImg = new Image();
          maskImg.src = dataUrl;
          maskImg.onload = () => {
            if (!isMounted) return;
            ctx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
            saveState();
            setImgLoaded(true);
            setIsAnalyzingFace(false);
          };
          maskImg.onerror = () => {
            if (isMounted) {
              setImgLoaded(true);
              setIsAnalyzingFace(false);
            }
          };
        }).catch(() => {
          if (isMounted) setIsAnalyzingFace(false);
        });
      }
    };

    return () => {
      isMounted = false;
    };
  }, [image]);

  const saveState = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      setHistory((prev) => [...prev.slice(-10), ctx.getImageData(0, 0, canvas.width, canvas.height)]);
    }
  };

  const handleUndo = () => {
    if (history.length <= 1) return;
    const newHist = [...history];
    newHist.pop();
    const prev = newHist[newHist.length - 1];
    setHistory(newHist);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx && prev) {
      ctx.putImageData(prev, 0, 0);
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      saveState();
    }
  };

  const handleAutoFaceMask = async () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || isAnalyzingFace) return;

    setIsAnalyzingFace(true);
    try {
      const dataUrl = await detectAndCreateFaceMaskDataUrl(image);
      const maskImg = new Image();
      maskImg.src = dataUrl;
      maskImg.onload = () => {
        ctx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
        saveState();
      };
    } finally {
      setIsAnalyzingFace(false);
    }
  };

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const [cursorPos, setCursorPos] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });
  const rafIdRef = useRef<number | null>(null);

  const drawStroke = (x1: number, y1: number, x2: number, y2: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.save();
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = mode === 'paint' ? brushOpacity : 1.0;

    if (mode === 'paint') {
      ctx.strokeStyle = 'white';
      ctx.fillStyle = 'white';
    } else {
      ctx.strokeStyle = 'black';
      ctx.fillStyle = 'black';
    }

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x2, y2, brushSize / 2, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    isDrawingRef.current = true;
    const coords = getCanvasCoords(e);
    lastPointRef.current = coords;
    drawStroke(coords.x, coords.y, coords.x, coords.y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const coords = getCanvasCoords(e);
    if (lastPointRef.current) {
      drawStroke(lastPointRef.current.x, lastPointRef.current.y, coords.x, coords.y);
    }
    lastPointRef.current = coords;
  };

  const stopDrawing = () => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      lastPointRef.current = null;
      saveState();
    }
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL('image/png'));
    onClose();
  };

  const handleMouseMoveWrapper = (e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const isInside =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;

    if (isInside) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        setCursorPos({ x, y, visible: true });
      });
    } else {
      if (cursorPos.visible) {
        setCursorPos((prev) => ({ ...prev, visible: false }));
      }
    }
  };

  const canvasRect = canvasRef.current?.getBoundingClientRect();
  const displayScale = canvasRect && canvasRef.current ? canvasRect.width / canvasRef.current.width : 1;
  const scaledBrushSize = Math.max(8, brushSize * displayScale);

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-[#10203a]/80 p-4 backdrop-blur-md" onMouseDown={onClose}>
      <section
        className="flex max-h-[95vh] w-[94vw] max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/40 bg-white shadow-2xl dark:bg-[#11151c]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex min-h-16 items-center justify-between border-b border-pastel-border px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Paintbrush className="h-6 w-6 text-[#ed6d46]" />
            <h2 className="text-lg font-black text-[#17243c] dark:text-white">涂抹目标场景人脸遮罩 (Face Masking)</h2>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl bg-pastel-bg text-pastel-muted hover:text-[#17243c]">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-pastel-border bg-[#f8fbff] px-6 py-3.5 dark:bg-black/20">
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setMode('paint')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition whitespace-nowrap shrink-0 ${
                mode === 'paint' ? 'bg-[#ed6d46] text-white shadow-sm' : 'bg-white border border-pastel-border text-pastel-muted'
              }`}
            >
              <Paintbrush className="h-4 w-4 shrink-0" /> <span className="whitespace-nowrap">涂抹人脸 (白色遮罩)</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('erase')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition whitespace-nowrap shrink-0 ${
                mode === 'erase' ? 'bg-[#17243c] text-white shadow-sm' : 'bg-white border border-pastel-border text-pastel-muted'
              }`}
            >
              <Eraser className="h-4 w-4 shrink-0" /> <span className="whitespace-nowrap">橡皮擦 (擦除)</span>
            </button>
          </div>

          <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
            <span className="text-sm font-bold text-pastel-muted whitespace-nowrap">粗细: {brushSize}px</span>
            <input
              type="range"
              min="10"
              max="120"
              value={brushSize}
              onChange={(e) => {
                const val = Number(e.target.value);
                setBrushSize(val);
                onBrushSettingsChange?.(val, brushOpacity);
              }}
              className="w-28 accent-[#ed6d46]"
            />
          </div>

          <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
            <span className="text-sm font-bold text-pastel-muted whitespace-nowrap">透明度: {Math.round(brushOpacity * 100)}%</span>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={brushOpacity}
              onChange={(e) => {
                const val = Number(e.target.value);
                setBrushOpacity(val);
                onBrushSettingsChange?.(brushSize, val);
              }}
              className="w-28 accent-[#ed6d46]"
            />
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <button
              type="button"
              onClick={handleAutoFaceMask}
              disabled={isAnalyzingFace}
              className="flex items-center gap-1.5 rounded-xl border border-orange-200 bg-[#fff8f3] px-3.5 py-2 text-sm font-bold text-[#d8552e] hover:bg-[#fff0e8] disabled:opacity-60 whitespace-nowrap shrink-0 shadow-2xs"
            >
              {isAnalyzingFace ? (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#ed6d46]" />
                  <span className="whitespace-nowrap">AI Agent 识别精准人脸中...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap">AI Agent 智能圈选人脸</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleUndo}
              disabled={history.length <= 1}
              className="flex items-center gap-1.5 rounded-xl border border-pastel-border bg-white px-3.5 py-2 text-sm font-bold text-pastel-muted hover:bg-pastel-bg disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              <Undo className="h-4 w-4 shrink-0" /> <span className="whitespace-nowrap">撤销</span>
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-bold text-red-600 hover:bg-red-100 whitespace-nowrap shrink-0"
            >
              <Trash2 className="h-4 w-4 shrink-0" /> <span className="whitespace-nowrap">清空</span>
            </button>
          </div>
        </div>

        <div
          ref={containerRef}
          onMouseMove={handleMouseMoveWrapper}
          onMouseLeave={() => setCursorPos({ x: 0, y: 0, visible: false })}
          className="relative flex flex-1 items-center justify-center overflow-auto bg-[#eef5fd] p-6 min-h-[500px]"
        >
          <div className="relative inline-block border border-pastel-border shadow-xl rounded-xl overflow-hidden max-h-[680px] cursor-none">
            <img src={getDataUrl(image)} alt="Scene Target" className="block max-h-[680px] max-w-full object-contain pointer-events-none" />
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              style={{ opacity: brushOpacity }}
              className="absolute inset-0 h-full w-full cursor-none mix-blend-screen"
            />
            {cursorPos.visible && (
              <div
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full z-40 transition-none"
                style={{
                  left: `${cursorPos.x}px`,
                  top: `${cursorPos.y}px`,
                  width: `${scaledBrushSize}px`,
                  height: `${scaledBrushSize}px`,
                  backgroundColor: mode === 'paint' ? 'rgba(237, 109, 70, 0.35)' : 'rgba(23, 36, 60, 0.45)',
                  border: mode === 'paint' ? '2.5px solid #ed6d46' : '2.5px solid #ffffff',
                  boxShadow: '0 0 0 1.5px #ffffff, 0 0 12px rgba(0,0,0,0.5)',
                }}
              />
            )}
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-pastel-border px-6 py-4 bg-white dark:bg-[#11151c]">
          <p className="text-sm text-pastel-muted">
            💡 <strong>涂抹提示:</strong> 用画笔涂满目标场景图中需要被替换的人脸与头部，白色区域为 AI 替换靶区。
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="rounded-xl border border-pastel-border px-5 py-2.5 text-sm font-bold text-pastel-muted hover:bg-pastel-bg">
              取消
            </button>
            <button type="button" onClick={handleSave} className="flex items-center gap-2 rounded-xl bg-[#17243c] px-6 py-2.5 text-sm font-black text-white hover:bg-[#253858] shadow-sm">
              <Check className="h-4.5 w-4.5" /> 保存涂抹蒙版
            </button>
          </div>
        </footer>
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const [maskEditingImage, setMaskEditingImage] = useState<UploadedImage | null>(null);
  const [isRatioModalOpen, setIsRatioModalOpen] = useState(false);
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [isPromptCopied, setIsPromptCopied] = useState(false);
  const [uploadingKind, setUploadingKind] = useState<UploadKind | null>(null);
  const [uploadingProgressText, setUploadingProgressText] = useState<string>('');

  const [maskBrushSize, setMaskBrushSize] = useState<number>(() => {
    const saved = localStorage.getItem('antigravity_mask_brush_size');
    return saved ? Number(saved) : 35;
  });
  const [maskBrushOpacity, setMaskBrushOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('antigravity_mask_brush_opacity');
    return saved ? Number(saved) : 1.0;
  });

  const activeUploadKindRef = useRef<UploadKind>('model');
  const modelInputRef = useRef<HTMLInputElement>(null);
  const sceneInputRef = useRef<HTMLInputElement>(null);

  const activeRecord = useMemo(
    () => records.find((r) => r.id === activeRecordId) || records[0],
    [records, activeRecordId]
  );

  const currentAspectItem = useMemo(
    () => ASPECT_OPTIONS.find((item) => item.id === activeRecord.aspectRatio) || ASPECT_OPTIONS[1],
    [activeRecord.aspectRatio]
  );

  const patchActive = useCallback(
    (patch: Partial<ModelTransferRecord>) => {
      setRecords((prev) =>
        prev.map((rec) => (rec.id === activeRecordId ? { ...rec, ...patch } : rec))
      );
    },
    [activeRecordId]
  );

  const {
    cancelMessage,
    startGenerationTask,
    cancelGenerationTask,
    isCurrentGenerationTask,
    assertCurrentGenerationTask,
    finishGenerationTask,
  } = useCancelableGeneration();

  const canGenerate = activeRecord.sourceModels.length > 0 && activeRecord.targetScenes.length > 0 && !isGenerating;
  const completedCount = activeRecord.results.filter((item) => item.status === 'done' || item.status === 'error' || item.status === 'cancelled').length;

  const startNewRecord = () => {
    if (isGenerating) return;
    const fresh = createRecord();
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
    const currentCount = kind === 'model' ? activeRecord.sourceModels.length : activeRecord.targetScenes.length;
    const max = kind === 'model' ? MAX_MODEL_IMAGES : MAX_SCENE_IMAGES;
    const accepted = valid.slice(0, Math.max(0, max - currentCount));
    if (!accepted.length) {
      if (valid.length) patchActive({ error: `${kind === 'model' ? '模特参考图' : '目标场景图'}最多上传 ${max} 张。` });
      return;
    }
    try {
      setUploadingKind(kind);
      setUploadingProgressText(
        kind === 'model'
          ? 'Agent 正在解析模特特征...'
          : 'Agent 正在检测人脸与生成蒙版...'
      );

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
        patchActive({ sourceModels: [...activeRecord.sourceModels, ...uploaded].slice(0, MAX_MODEL_IMAGES) });
      } else {
        const scenesWithMasks = await Promise.all(uploaded.map(async (sc) => {
          const maskDataUrl = await detectAndCreateFaceMaskDataUrl(sc);
          return { ...sc, maskDataUrl };
        }));
        patchActive({ targetScenes: [...activeRecord.targetScenes, ...scenesWithMasks].slice(0, MAX_SCENE_IMAGES) });
      }

      patchActive({ error: null });
    } catch (err: any) {
      patchActive({ error: getErrorMessage(err) });
    } finally {
      setUploadingKind(null);
      setUploadingProgressText('');
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
      patchActive({ sourceModels: activeRecord.sourceModels.filter((m) => m.id !== id) });
    } else {
      patchActive({ targetScenes: activeRecord.targetScenes.filter((s) => s.id !== id) });
    }
  };

  const handleSaveMask = (sceneId: string, maskDataUrl: string) => {
    patchActive({
      targetScenes: activeRecord.targetScenes.map((sc) => (sc.id === sceneId ? { ...sc, maskDataUrl } : sc)),
    });
  };

  // Auto-generate missing face masks for target scenes when in active workflow steps
  useEffect(() => {
    if (activeRecord.checkpoint !== 'input' && !isGenerating && activeRecord.targetScenes.some((sc) => !sc.maskDataUrl)) {
      void (async () => {
        const updated = await Promise.all(
          activeRecord.targetScenes.map(async (sc) => {
            if (sc.maskDataUrl) return sc;
            const maskDataUrl = await detectAndCreateFaceMaskDataUrl(sc);
            return { ...sc, maskDataUrl };
          })
        );
        patchActive({ targetScenes: updated });
      })();
    }
  }, [activeRecord.checkpoint, activeRecord.targetScenes, isGenerating, patchActive]);

  // ==================== Agent Step-by-Step Handlers ====================

  const runStep1_Analyze = async () => {
    if (!activeRecord.sourceModels.length || !activeRecord.targetScenes.length || isGenerating) return;

    const { taskId, signal } = startGenerationTask();
    patchActive({ error: null, agentAnalysis: null, step: 'analyzing' });
    setIsGenerating(true);
    setStatusMessage('Agent 正在深度解析源模特基因与目标场景光影...');

    try {
      assertCurrentGenerationTask(taskId, signal);
      const text = await generateText(
        [...activeRecord.sourceModels.map(toApiImage), ...activeRecord.targetScenes.map(toApiImage)],
        buildAgentPrompt(activeRecord.sourceModels.length, activeRecord.extraNotes)
      );
      assertCurrentGenerationTask(taskId, signal);

      const defaultTransferPrompt = buildTransferPrompt({
        sourceCount: activeRecord.sourceModels.length,
        analysis: fallbackAnalysis(activeRecord.extraNotes),
        transferSourceOutfit: detectsSourceOutfitRequest(activeRecord.extraNotes),
        hasMask: true,
        extraNotes: activeRecord.extraNotes,
        sceneNumber: 1,
      });

      const analysis = parseAgentAnalysis(text, activeRecord.extraNotes, defaultTransferPrompt);

      // Pre-generate face masks for all target scenes if missing
      const scenesWithMasks = await Promise.all(
        activeRecord.targetScenes.map(async (sc) => {
          if (sc.maskDataUrl) return sc;
          const maskDataUrl = await detectAndCreateFaceMaskDataUrl(sc);
          return { ...sc, maskDataUrl };
        })
      );

      patchActive({
        agentAnalysis: analysis,
        targetScenes: scenesWithMasks,
        checkpoint: 'analyzed',
        step: 'analyzing',
      });
      setStatusMessage('Agent 分析完成，请确认人脸涂抹遮罩与光影方案。');

      if (activeRecord.oneClick) {
        finishGenerationTask(taskId);
        setIsGenerating(false);
        await runStep2_MaskingCheck(analysis);
        return;
      }
    } catch (err: any) {
      if (!isAbortError(err)) patchActive({ error: getErrorMessage(err), step: 'input' });
    } finally {
      if (isCurrentGenerationTask(taskId)) {
        finishGenerationTask(taskId);
        setIsGenerating(false);
      }
    }
  };

  const runStep2_MaskingCheck = async (analysis = activeRecord.agentAnalysis || fallbackAnalysis(activeRecord.extraNotes)) => {
    patchActive({ checkpoint: 'masked', step: 'color' });
    setStatusMessage('Agent 已确认目标场景图人脸涂抹遮罩就绪。');

    if (activeRecord.oneClick) {
      await runStep3_FinalTransfer(analysis);
    }
  };

  const runStep3_FinalTransfer = async (analysis = activeRecord.agentAnalysis || fallbackAnalysis(activeRecord.extraNotes)) => {
    const sources = [...activeRecord.sourceModels];
    const scenes = [...activeRecord.targetScenes];
    const { taskId, signal } = startGenerationTask();

    patchActive({ error: null, step: 'upscaling' });
    setIsGenerating(true);
    patchActive({
      results: scenes.map((scene) => ({
        id: `pending-${scene.id}`,
        sceneId: scene.id,
        sceneName: scene.name,
        imageUrl: null,
        status: 'pending',
        prompt: '',
      })),
    });

    try {
      assertCurrentGenerationTask(taskId, signal);
      setStatusMessage('正在提取模特身份锚点与目标遮罩图层...');

      const [identityAnchors, preparedScenes] = await Promise.all([
        prepareIdentityAnchors(sources),
        prepareScenes(scenes),
      ]);
      assertCurrentGenerationTask(taskId, signal);

      setStatusMessage(`已并发提交 ${scenes.length} 个场景的精准人脸迁移与光影重建...`);

      const settled = await Promise.allSettled(
        preparedScenes.map((prepared, sceneIndex) =>
          generatePreparedScene({ prepared, sceneIndex, sources, identityAnchors, analysis, signal })
            .then((item) => {
              if (isCurrentGenerationTask(taskId)) updateResult(prepared.scene.id, item);
              return item;
            })
            .catch((itemError) => {
              if (isAbortError(itemError)) {
                if (isCurrentGenerationTask(taskId)) updateResult(prepared.scene.id, { status: 'cancelled', error: '已中止' });
                throw itemError;
              }
              const failed: ResultItem = {
                id: `error-${prepared.scene.id}`,
                sceneId: prepared.scene.id,
                sceneName: prepared.scene.name,
                imageUrl: null,
                status: 'error',
                prompt: '',
                error: getErrorMessage(itemError),
              };
              if (isCurrentGenerationTask(taskId)) updateResult(prepared.scene.id, failed);
              return failed;
            })
        )
      );

      assertCurrentGenerationTask(taskId, signal);
      const batchResults = settled
        .filter((entry): entry is PromiseFulfilledResult<ResultItem> => entry.status === 'fulfilled')
        .map((entry) => entry.value);

      await saveBatch(sources, scenes, analysis, batchResults);
      patchActive({ checkpoint: 'complete', step: 'complete' });
      setStatusMessage(`批量迁移完成：${batchResults.filter((item) => item.status === 'done').length}/${scenes.length} 张成功`);
    } catch (generateError) {
      if (!isAbortError(generateError)) patchActive({ error: getErrorMessage(generateError) });
    } finally {
      if (!isCurrentGenerationTask(taskId)) return;
      finishGenerationTask(taskId);
      setIsGenerating(false);
    }
  };

  const prepareIdentityAnchors = (sources: UploadedImage[]) => Promise.all(
    sources.map(async (source) => dataUrlToApiImage(await createModelHeadIdentityCrop(getDataUrl(source))))
  );

  const prepareScenes = (scenes: UploadedImage[]) => Promise.all(
    scenes.map(async (scene): Promise<PreparedScene> => {
      const poseAnchor = dataUrlToApiImage(await extractEdges(getDataUrl(scene)));
      const maskAnchor = scene.maskDataUrl ? dataUrlToApiImage(scene.maskDataUrl) : undefined;
      return { scene, poseAnchor, maskAnchor };
    })
  );

  const updateResult = (sceneId: string, patch: Partial<ResultItem>) => {
    setRecords((prev) =>
      prev.map((rec) => {
        if (rec.id !== activeRecordId) return rec;
        const exists = rec.results.some((item) => item.sceneId === sceneId);
        const updatedResults: ResultItem[] = exists
          ? rec.results.map((item) => (item.sceneId === sceneId ? { ...item, ...patch } : item))
          : [...rec.results, { id: `result-${sceneId}`, sceneId, sceneName: '', imageUrl: null, status: 'pending' as GenerationStatus, prompt: '', ...patch }];
        return {
          ...rec,
          results: updatedResults,
        };
      })
    );
  };

  const generatePreparedScene = async (options: {
    prepared: PreparedScene;
    sceneIndex: number;
    sources: UploadedImage[];
    identityAnchors: Array<{ base64: string; mimeType: string }>;
    analysis: AgentAnalysis;
    signal: AbortSignal;
  }): Promise<ResultItem> => {
    const { prepared, sceneIndex, sources, identityAnchors, analysis, signal } = options;
    const transferSourceOutfit = activeRecord.outfitMode === 'source' || (activeRecord.outfitMode === 'auto' && analysis.transferSourceOutfit);
    const prompt = buildTransferPrompt({
      sourceCount: sources.length,
      analysis,
      transferSourceOutfit,
      hasMask: Boolean(prepared.maskAnchor),
      extraNotes: activeRecord.extraNotes,
      sceneNumber: sceneIndex + 1,
    });
    updateResult(prepared.scene.id, { status: 'submitting', error: undefined, prompt });

    const inputImages = [
      toApiImage(prepared.scene),
    ];
    if (prepared.maskAnchor) {
      inputImages.push(prepared.maskAnchor);
    }
    inputImages.push(...identityAnchors);
    inputImages.push(...sources.map(toApiImage));

    const [rawImage] = await generateImageToImage(
      inputImages,
      prompt,
      {
        aspectRatio: activeRecord.aspectRatio,
        resolution: activeRecord.resolution,
        modelId: activeRecord.selectedModel,
        workflowHint: 'model-transfer',
        hasModelRef: true,
        signal,
        onStatus: (status) => updateResult(prepared.scene.id, { status }),
      }
    );

    if (!rawImage) throw new Error('模型未返回图片。');
    updateResult(prepared.scene.id, { status: 'processing' });
    const correctedImage = await applyColorCorrection(rawImage, {
      mode: activeRecord.colorCorrectionMode,
      reference: activeRecord.colorCorrectionMode === 'match' ? getDataUrl(prepared.scene) : undefined,
      blend: activeRecord.colorCorrectionBlend,
    });

    let finalBaseImage = correctedImage;
    if (!transferSourceOutfit) {
      finalBaseImage = await compositeInpaintedFaceBack(
        getDataUrl(prepared.scene),
        correctedImage,
        prepared.scene.maskDataUrl
      );
    }

    const formattedImage = await convertImageDataUrlFormat(finalBaseImage, activeRecord.outputFormat);
    const finalResult: ResultItem = {
      id: `result-${prepared.scene.id}`,
      sceneId: prepared.scene.id,
      sceneName: prepared.scene.name,
      imageUrl: formattedImage,
      status: 'done',
      prompt,
    };
    updateResult(prepared.scene.id, finalResult);
    return finalResult;
  };

  const saveBatch = async (sources: UploadedImage[], scenes: UploadedImage[], analysis: AgentAnalysis, batchResults: ResultItem[]) => {
    const successful = batchResults.filter((item) => item.status === 'done' && item.imageUrl);
    if (!successful.length) return;
    const effectiveOutfitTransfer = activeRecord.outfitMode === 'source' || (activeRecord.outfitMode === 'auto' && analysis.transferSourceOutfit);
    await saveGeneratedProject({
      type: 'MODEL',
      generated: successful.map((item) => item.imageUrl!),
      original: [...sources, ...scenes].map(getDataUrl),
      prompt: successful[0].prompt,
      params: {
        subType: 'model_transfer_batch',
        source: 'Cyzx4/components/ModelTransferTab',
        aspectRatio: activeRecord.aspectRatio,
        resolution: activeRecord.resolution,
        model: activeRecord.selectedModel,
        outputFormat: activeRecord.outputFormat,
        sourceModelCount: sources.length,
        targetSceneCount: scenes.length,
        outfitMode: activeRecord.outfitMode,
        transferSourceOutfit: effectiveOutfitTransfer,
        outfitReason: analysis.outfitReason,
        colorCorrectionMode: activeRecord.colorCorrectionMode,
        colorCorrectionBlend: activeRecord.colorCorrectionBlend,
        extraNotes: activeRecord.extraNotes,
        identityBrief: analysis.identityBrief,
        sceneResultMap: batchResults.map((item) => ({ sceneId: item.sceneId, sceneName: item.sceneName, status: item.status, error: item.error })),
      },
      thumbnail: successful[0].imageUrl || undefined,
    });
  };

  const handleCancelGenerate = () => {
    cancelGenerationTask('已中止模特迁移生成');
    patchActive({
      results: activeRecord.results.map((item) =>
        ['pending', 'submitting', 'polling', 'processing'].includes(item.status)
          ? { ...item, status: 'cancelled', error: '已中止' }
          : item
      ),
    });
    setIsGenerating(false);
    setStatusMessage('');
  };

  const handleDownload = (url: string, index: number) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `model-transfer-${index + 1}.${getImageDownloadExtension(url, activeRecord.outputFormat)}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = () => activeRecord.results.forEach((item, index) => {
    if (item.imageUrl) handleDownload(item.imageUrl, index);
  });

  const effectiveOutfitLabel = useMemo(() => {
    if (activeRecord.outfitMode === 'source') return '强制迁移源服装';
    if (activeRecord.outfitMode === 'target') return '强制保留场景服装';
    if (!activeRecord.agentAnalysis) return '等待 AI 判断';
    return activeRecord.agentAnalysis.transferSourceOutfit ? 'AI：迁移源服装' : 'AI：保留场景服装';
  }, [activeRecord]);

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

  // History Panel Component (Matches SceneGenerationTab 1:1)
  const historyPanel = (
    <aside className="flex h-full min-h-[520px] flex-col rounded-2xl border border-[#d8e3ee] bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#11151c]">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-base font-black text-[#17243c] dark:text-white">生成记录</h2>
          <p className="mt-0.5 text-xs text-pastel-muted">当前会话最多20项</p>
        </div>
        <button
          type="button"
          onClick={() => setIsHistoryOpen(false)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-pastel-border text-pastel-muted hover:bg-pastel-bg"
          aria-label="收起生成记录"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={startNewRecord}
        disabled={isGenerating}
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#17243c] text-xs font-black text-white hover:bg-[#253858] disabled:opacity-40 shadow-md"
      >
        <Plus className="h-4 w-4" /> 新开任务
      </button>

      <div className="mt-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
        <div className="grid grid-cols-2 gap-2.5">
          {records.map((rec) => {
            const isCurrentRec = rec.id === activeRecord.id;
            const thumbnailImage =
              rec.results.find((r) => r.imageUrl)?.imageUrl ||
              (rec.targetScenes[0] ? (rec.targetScenes[0].preview || getDataUrl(rec.targetScenes[0])) : null) ||
              rec.sourceModels[0]?.preview;

            const doneCount = rec.results.filter((r) => r.status === 'done' && r.imageUrl).length;
            const statusText = doneCount > 0
              ? `${doneCount}张已生成`
              : rec.results.length > 0
              ? '迁移中'
              : rec.sourceModels.length || rec.targetScenes.length
              ? '编辑中'
              : '空任务';

            const timeText = new Date(rec.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <div
                key={rec.id}
                onClick={() => {
                  if (!isGenerating) setActiveRecordId(rec.id);
                }}
                className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border-2 transition-all shadow-2xs ${
                  isCurrentRec
                    ? 'border-[#ed6d46] bg-white ring-2 ring-[#ed6d46]/20'
                    : 'border-[#d8e3ee] bg-white hover:border-[#ed6d46]/60'
                }`}
              >
                {/* Thumbnail Viewport */}
                <div className="relative aspect-square w-full overflow-hidden bg-slate-900 flex items-center justify-center">
                  {thumbnailImage ? (
                    <img
                      src={thumbnailImage}
                      alt="Record Thumbnail"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-2 text-pastel-muted">
                      <ImageIcon className="h-6 w-6 stroke-1 opacity-50 text-slate-400" />
                      <span className="mt-0.5 text-[9px] font-bold">无素材</span>
                    </div>
                  )}

                  {/* Top-Right Trash Delete Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteRecord(rec.id);
                    }}
                    className="absolute top-1.5 right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white hover:bg-red-500 hover:text-white shadow-sm backdrop-blur-md transition-colors"
                    title="删除记录"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>

                  {/* Bottom Overlay Dark Bar inside thumbnail */}
                  <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between bg-[#17243c]/90 px-2 py-1 text-white backdrop-blur-xs">
                    <span className="truncate text-[10px] font-black text-white">{statusText}</span>
                    {doneCount > 0 && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                    )}
                  </div>
                </div>

                {/* Bottom Footer Info */}
                <div className="flex items-center justify-between px-2 py-1 text-[0.65rem] font-bold text-pastel-muted bg-white dark:bg-[#11151c]">
                  <span className="truncate text-slate-700 dark:text-slate-200">
                    {rec.sourceModels[0]?.name || '默认任务'}
                  </span>
                  <span className="shrink-0">{timeText}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );

  const renderUploadArea = (kind: UploadKind) => {
    const isModel = kind === 'model';
    const images = isModel ? activeRecord.sourceModels : activeRecord.targetScenes;
    const max = isModel ? MAX_MODEL_IMAGES : MAX_SCENE_IMAGES;
    const inputRef = isModel ? modelInputRef : sceneInputRef;

    return (
      <section
        onMouseEnter={() => activateUploadKind(kind)}
        className={`rounded-2xl border bg-white p-4 shadow-sm sm:p-5 dark:bg-[#11151c] ${
          activeUploadKind === kind ? 'border-[#ed6d46]/50 ring-1 ring-[#ed6d46]/20' : 'border-pastel-border'
        }`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <div className="mt-0.5 text-[#ed6d46]">{isModel ? <UserRound className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}</div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-[#17243c] dark:text-white">{isModel ? '我的模特参考图' : '目标场景图 (含局部人脸涂抹)'}</h3>
              <p className="mt-1 text-xs leading-relaxed text-pastel-muted">
                {isModel ? '最多 3 张：正面、侧面、微侧，共同锁定同一人物长相与身材。' : '最多 10 张，点击“涂抹人脸”可遮罩原脸以达到最自然的光影融入。'}
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-[#fff0e8] px-2.5 py-1 text-xs font-black text-[#d8552e]">{images.length}/{max}</span>
        </div>

        <div className={`grid grid-cols-1 gap-3 ${isModel ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3' : 'grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 xl:grid-cols-3'}`}>
          {images.map((image, index) => (
            <div key={image.id} className="relative overflow-hidden rounded-xl border border-pastel-border bg-pastel-bg/30 flex flex-col group transition-all hover:border-[#ed6d46]/40 hover:shadow-sm">
              <div className="aspect-[4/3] overflow-hidden bg-white relative">
                <img src={image.preview} alt={isModel ? `模特${MODEL_SLOTS[index]}` : `目标场景${index + 1}`} className="h-full w-full object-contain" />
                {!isModel && image.maskDataUrl && (
                  <span className="absolute top-2 left-2 rounded-full bg-[#ed6d46] text-white px-2 py-0.5 text-[0.65rem] font-black flex items-center gap-1 shadow whitespace-nowrap z-10 shrink-0">
                    <Check className="h-3 w-3 shrink-0" /> <span className="whitespace-nowrap">已含人脸遮罩</span>
                  </span>
                )}
              </div>

              <div className="flex min-h-11 items-center justify-between gap-1.5 border-t border-pastel-border px-2.5 py-1.5 bg-white dark:bg-[#11151c]">
                <span className="truncate text-xs font-bold text-pastel-text dark:text-white min-w-0 shrink">
                  {isModel ? MODEL_SLOTS[index] : `场景 ${index + 1}`}
                </span>

                <div className="flex items-center gap-1 shrink-0 whitespace-nowrap">
                  {!isModel && (
                    <button
                      type="button"
                      onClick={() => setMaskEditingImage(image)}
                      disabled={isGenerating}
                      className="flex items-center gap-1 rounded-lg border border-orange-200 bg-[#fff8f3] px-2 py-1 text-[0.68rem] font-black text-[#d8552e] hover:bg-[#fff0e8] whitespace-nowrap shrink-0 transition-colors shadow-2xs"
                      title="涂抹人脸区域"
                    >
                      <Paintbrush className="h-3.5 w-3.5 shrink-0 text-[#ed6d46]" />
                      <span className="whitespace-nowrap">涂抹人脸</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeUploadedImage(kind, image.id)}
                    disabled={isGenerating}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-pastel-muted hover:bg-red-50 hover:text-red-500 disabled:opacity-40 transition-colors"
                    aria-label="删除图片"
                  >
                    <X className="h-4 w-4 shrink-0" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {uploadingKind === kind && (
            <div className="relative overflow-hidden rounded-xl border-2 border-[#ed6d46] bg-[#fff8f3] p-3 flex flex-col items-center justify-center min-h-36 sm:min-h-44 text-center animate-pulse shadow-md">
              <div className="relative mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#fff0e8] text-[#ed6d46]">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="absolute inset-0 rounded-full border border-[#ed6d46] animate-ping opacity-75" />
              </div>
              <span className="text-xs font-black text-[#d8552e]">Agent 识别上传中...</span>
              <span className="mt-1 text-[10px] text-pastel-muted">多模态 AI 正在精准定界人脸与处理画质</span>
            </div>
          )}

          {images.length < max && uploadingKind !== kind ? (
            <button
              type="button"
              onClick={() => { activateUploadKind(kind); inputRef.current?.click(); }}
              onDragOver={(event) => { event.preventDefault(); activateUploadKind(kind); }}
              onDrop={(event) => { event.preventDefault(); activateUploadKind(kind); void processFiles(Array.from(event.dataTransfer.files), kind); }}
              className="flex min-h-36 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cbd8e8] bg-[#f8fbff] p-4 text-center transition-colors hover:border-[#ed6d46] sm:min-h-44"
            >
              <Upload className="mb-2 h-7 w-7 text-[#ed6d46]" />
              <span className="text-sm font-black text-[#17243c] dark:text-white">点击或拖入图片</span>
              <span className="mt-1 text-xs text-pastel-muted">选中此区域后也可 Ctrl+V</span>
            </button>
          ) : null}
        </div>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => { void processFiles(Array.from(event.target.files || []), kind); event.target.value = ''; }} />
      </section>
    );
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-[#f4f8fc] p-4 text-[#17243c] dark:bg-[#0b0f14] dark:text-white sm:p-6">
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6">
        

        {/* Top Hero Banner (Compact Streamlined Bar) */}
        <section className="relative overflow-hidden rounded-2xl border border-[#d8e3ee] bg-white px-5 py-3.5 shadow-sm dark:border-white/10 dark:bg-[#11151c]">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#fff0e8]/80 blur-2xl pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff0e8] text-[#ed6d46]">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-black text-[#17243c] dark:text-white">
                  高精模特并发迁移与人脸融合
                </h2>
                <p className="text-[0.72rem] text-pastel-muted">
                  锁定模特特征与目标场景，精准遮罩人脸，无缝光影融合换脸。
                </p>
              </div>
            </div>

            <WorkflowSteps step={activeRecord.step} />
          </div>
        </section>

        {/* Floating Bottom-Left Collapsed Record Button (Matches SceneGenerationTab 1:1) */}
        {!isHistoryOpen && (
          <button
            type="button"
            onClick={() => setIsHistoryOpen(true)}
            className="fixed bottom-5 left-4 z-40 flex min-h-11 items-center gap-2 rounded-full border border-pastel-border bg-white px-4 text-xs font-black shadow-[0_8px_24px_rgba(30,50,80,0.16)] xl:left-24 dark:bg-[#11151c] dark:border-white/10 dark:text-white"
          >
            <PanelLeftOpen className="h-4 w-4 text-[#ed6d46]" />
            生成记录
            <span className="rounded-full bg-pastel-bg px-2 py-0.5 text-[0.68rem] text-pastel-muted dark:bg-white/10">{records.length}</span>
          </button>
        )}

        {/* Main 3-Column Grid Layout */}
        <div className={`grid grid-cols-1 gap-5 lg:grid-cols-12`}>
          
          {/* Left Column: History Panel */}
          {isHistoryOpen && (
            <div className="col-span-12 lg:col-span-3">
              {historyPanel}
            </div>
          )}

          {/* Middle Column: Controls Panel */}
          <div className={`col-span-12 ${isHistoryOpen ? 'lg:col-span-4' : 'lg:col-span-5'} flex flex-col gap-3`}>
            {renderUploadArea('model')}
            {renderUploadArea('scene')}

            {/* Model & Outfit Strategy Card */}
            <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c]">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-[#ed6d46]" />
                  <h3 className="text-xs font-black text-[#17243c] dark:text-white">生成模型</h3>
                </div>
              </div>

              {/* Model Options */}
              <div className="grid grid-cols-3 gap-2">
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

              {/* Outfit Strategy */}
              <div className="mt-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-black text-pastel-muted">服装策略</span>
                  <span className="rounded-full bg-[#fff0e8] px-2 py-0.5 text-[0.68rem] font-black text-[#d8552e]">{effectiveOutfitLabel}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {OUTFIT_OPTIONS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => patchActive({ outfitMode: item.id })}
                      disabled={isGenerating}
                      className={`min-h-11 rounded-xl border px-2 py-1 text-center transition ${
                        activeRecord.outfitMode === item.id ? 'border-[#ed6d46] bg-[#fff8f3] text-[#d8552e] font-black' : 'border-pastel-border bg-white text-pastel-text'
                      }`}
                    >
                      <span className="block text-xs font-black">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Aspect Ratio & Resolution Trigger Card */}
            <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff0e8] text-[#ed6d46]">
                    <Maximize className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-xs font-black text-[#17243c] dark:text-white">画幅比例与分辨率</h3>
                    <p className="mt-0.5 text-xs text-pastel-muted">
                      当前：<strong className="text-[#ed6d46]">{currentAspectItem.label} ({currentAspectItem.desc})</strong> · <span className="font-bold text-[#17243c] dark:text-white">{activeRecord.resolution}</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsRatioModalOpen(true)}
                  disabled={isGenerating}
                  className="flex items-center gap-1 rounded-xl border border-orange-200 bg-[#fff8f3] px-3 py-2 text-xs font-black text-[#d8552e] hover:bg-[#fff0e8] shrink-0 transition-colors shadow-2xs"
                >
                  <span>修改比例与分辨率</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </section>

            {/* Color Correction Card */}
            <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c]">
              <div className="mb-3 flex items-center gap-2">
                <Sun className="h-5 w-5 text-[#ed6d46]" />
                <h3 className="text-xs font-black text-[#17243c] dark:text-white">色彩修正</h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['off', 'match', 'autoWhiteBalance', 'redSuppress'] as ColorCorrectionMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => patchActive({ colorCorrectionMode: mode })}
                    disabled={isGenerating}
                    className={`min-h-10 rounded-xl border px-2 text-xs font-black ${
                      activeRecord.colorCorrectionMode === mode ? 'border-[#ed6d46] bg-[#fff0e8] text-[#d8552e]' : 'border-pastel-border text-pastel-muted'
                    }`}
                  >
                    {({ off: '关闭修正', match: '匹配各场景光影', autoWhiteBalance: '自动白平衡', redSuppress: '压红补青' } as Record<ColorCorrectionMode, string>)[mode]}
                  </button>
                ))}
              </div>
            </section>

            {/* Prompt Notes & One-Click Toggle Card */}
            <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c]">
              <textarea
                value={activeRecord.extraNotes}
                onChange={(event) => patchActive({ extraNotes: event.target.value })}
                disabled={isGenerating}
                placeholder="补充要求，例如：保持人脸轮廓光滑，适应黄昏冷暖感光影..."
                className="min-h-20 w-full resize-y rounded-xl border border-pastel-border bg-pastel-bg px-3 py-2.5 text-xs outline-none focus:border-[#ed6d46]"
              />

              <label className="mt-3 flex cursor-pointer items-center justify-between rounded-xl border border-pastel-border bg-pastel-bg/40 p-3">
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
                  <i className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${activeRecord.oneClick ? 'left-5.5' : 'left-0.5'}`} />
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

            {activeRecord.checkpoint === 'analyzed' && !isGenerating && (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => void runStep2_MaskingCheck()}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-black text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition"
                >
                  <span>已完成分析，请核对右侧遮罩</span>
                  <Check className="h-4 w-4 text-emerald-500" />
                </button>
                <button
                  type="button"
                  onClick={() => void runStep1_Analyze()}
                  className="min-h-9 rounded-xl text-xs text-pastel-muted hover:text-pastel-text"
                >
                  重新进行 Agent 分析
                </button>
              </div>
            )}

            {activeRecord.checkpoint === 'masked' && !isGenerating && (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => void runStep3_FinalTransfer()}
                  className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#17243c] text-sm font-black text-white shadow-[0_14px_28px_rgba(23,36,60,0.18)] transition hover:-translate-y-0.5"
                >
                  <Sparkles className="h-5 w-5 text-[#ff9b67]" />
                  <span>确认蒙版，开始光影融合模特换脸</span>
                </button>
                <button
                  type="button"
                  onClick={() => patchActive({ checkpoint: 'analyzed' })}
                  className="min-h-10 rounded-xl border border-pastel-border text-xs font-black text-pastel-muted hover:bg-pastel-bg"
                >
                  返回人脸涂抹检查
                </button>
              </div>
            )}

            {activeRecord.checkpoint === 'complete' && !isGenerating && (
              <button
                type="button"
                onClick={startNewRecord}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-pastel-border bg-white text-xs font-black text-[#17243c] hover:border-[#ed6d46] hover:text-[#ed6d46]"
              >
                <RotateCcw className="h-4 w-4" /> 开始新模特迁移任务
              </button>
            )}

            {isGenerating && (
              <button type="button" onClick={handleCancelGenerate} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 px-4 py-3 text-sm font-bold text-white">
                <X className="h-4 w-4" /> 中止全部任务
              </button>
            )}
            {cancelMessage && !isGenerating ? <p className="text-center text-sm font-bold text-[#d8552e]">{cancelMessage}</p> : null}
            {activeRecord.error && <p className="text-center text-xs font-bold text-red-500">{activeRecord.error}</p>}
          </div>

          {/* Right Column: Agent Checkpoints & Results Canvas */}
          <div className={`col-span-12 ${isHistoryOpen ? 'lg:col-span-5' : 'lg:col-span-7'} flex flex-col gap-4`}>
            
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
                  <span className="text-xs font-black text-[#d8552e]">服装策略：{activeRecord.agentAnalysis.transferSourceOutfit ? '迁移源模特服装' : '保留场景服装'}</span>
                  <span className="text-xs text-pastel-muted">{activeRecord.agentAnalysis.outfitReason}</span>
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
              </section>
            )}

            {/* Target Scene Mask Verification & Action Gallery (Step 3: 遮罩确认) */}
            {!isGenerating && (activeRecord.checkpoint === 'analyzed' || activeRecord.checkpoint === 'masked') && !activeRecord.results.length && (
              <section className="rounded-2xl border border-pastel-border bg-white p-5 shadow-sm dark:bg-[#11151c]">
                <div className="mb-4 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between border-b border-pastel-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <Paintbrush className="h-5 w-5 text-[#ed6d46]" />
                    <h3 className="text-base font-black text-[#17243c] dark:text-white">
                      目标场景人脸遮罩核对与微调 ({activeRecord.targetScenes.length} 个场景)
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-pastel-muted">
                    💡 白色半透明区域为 AI 替换靶区
                  </span>
                </div>

                {/* Scene Mask Verification Grid */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {activeRecord.targetScenes.map((scene, idx) => (
                    <div key={scene.id || idx} className="group relative overflow-hidden rounded-2xl border border-pastel-border bg-[#f8fbff] dark:bg-black/20 flex flex-col shadow-sm">
                      {/* Photo Container showing scene and white face mask */}
                      <div className={`relative w-full ${getCardAspectRatioClass(activeRecord.aspectRatio)} overflow-hidden bg-slate-900 flex items-center justify-center`}>
                        <img src={getDataUrl(scene)} alt={`场景 ${idx + 1}`} className="h-full w-full object-contain" />
                        
                        {/* Overlay white mask preview if available */}
                        {scene.maskDataUrl && (
                          <img src={scene.maskDataUrl} alt="Mask Overlay" className="absolute inset-0 h-full w-full object-contain opacity-40 mix-blend-screen pointer-events-none" />
                        )}

                        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded-full bg-black/75 px-3 py-1 text-[11px] font-black text-white backdrop-blur-md border border-white/20">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          <span>{scene.maskDataUrl ? 'Agent 精准人脸遮罩' : '默认人脸遮罩'}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setMaskEditingImage(scene)}
                          className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 rounded-xl bg-[#17243c]/90 px-3.5 py-2 text-xs font-black text-white hover:bg-[#ed6d46] transition-all shadow-lg backdrop-blur-md border border-white/20"
                        >
                          <Paintbrush className="h-3.5 w-3.5 text-[#ff9b67]" />
                          <span>涂抹微调遮罩</span>
                        </button>
                      </div>

                      <div className="flex min-h-12 items-center justify-between border-t border-pastel-border px-3.5 bg-white dark:bg-[#11151c]">
                        <span className="text-xs font-black text-[#17243c] dark:text-white">场景 {idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => setMaskEditingImage(scene)}
                          className="text-xs font-black text-[#d8552e] hover:underline flex items-center gap-1"
                        >
                          <Paintbrush className="h-3 w-3" />
                          <span>打开全屏画布</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Direct Action Confirmation Button */}
                <div className="mt-5 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => void runStep3_FinalTransfer()}
                    className="flex-1 flex min-h-14 items-center justify-center gap-2.5 rounded-2xl bg-[#ed6d46] text-sm font-black text-white shadow-[0_14px_28px_rgba(237,109,70,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e05b33]"
                  >
                    <Sparkles className="h-5 w-5" />
                    <span>确认蒙版无误，开始光影融合模特换脸</span>
                    <ArrowRight className="h-4.5 w-4.5" />
                  </button>
                </div>
              </section>
            )}

            {/* Empty State placeholder */}
            {activeRecord.checkpoint === 'input' && !isGenerating && !activeRecord.results.length && (
              <section className="flex min-h-[34rem] flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#cedbe8] bg-white/75 p-8 text-center">
                <span className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-[#fff1e8] text-[#ed6d46]">
                  <UserRound className="h-9 w-9" />
                </span>
                <h2 className="mt-5 text-xl font-black text-[#17243c]">先上传模特图与场景图，再开始 Agent 迁移</h2>
                <p className="mt-2 max-w-lg text-sm leading-7 text-pastel-muted">
                  上传 1–3 张模特参考图和 1–10 张目标场景图。可用“涂抹人脸”精准定界，Agent 将把关每步光影与特征融合。
                </p>
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
                        <article key={item.sceneId} className={`group relative overflow-hidden rounded-2xl border ${!item.imageUrl && isGenerating ? 'border-2 border-[#ed6d46] animate-pulse-border' : 'border-pastel-border'} bg-white shadow-md`}>
                          <div className={`relative w-full ${getCardAspectRatioClass(activeRecord.aspectRatio)} overflow-hidden bg-slate-950`}>
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={`模特迁移 ${index + 1}`} className="h-full w-full object-contain cursor-zoom-in" onClick={() => setSelectedPreview(item.imageUrl!)} />
                            ) : item.status === 'error' || item.status === 'cancelled' ? (
                              <div className="flex h-full w-full items-center justify-center p-5 text-center text-sm font-bold text-red-500">{item.error || statusLabel(item.status)}</div>
                            ) : (
                              <div className="relative h-full w-full overflow-hidden">
                                {activeRecord.targetScenes[index] && (
                                  <img src={getDataUrl(activeRecord.targetScenes[index])} alt="Target Scene" className="h-full w-full object-cover opacity-70 filter brightness-95" />
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
                                    <span className="block text-xs font-black text-white truncate">场景 {index + 1}</span>
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

      {maskEditingImage && (
        <FaceMaskModal
          image={maskEditingImage}
          initialBrushSize={maskBrushSize}
          initialBrushOpacity={maskBrushOpacity}
          onBrushSettingsChange={(size, opacity) => {
            setMaskBrushSize(size);
            setMaskBrushOpacity(opacity);
            localStorage.setItem('antigravity_mask_brush_size', size.toString());
            localStorage.setItem('antigravity_mask_brush_opacity', opacity.toString());
          }}
          onSave={(maskDataUrl) => handleSaveMask(maskEditingImage.id, maskDataUrl)}
          onClose={() => setMaskEditingImage(null)}
        />
      )}

      {/* Aspect Ratio & Resolution Modal Dialog */}
      {isRatioModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-[#10203a]/70 p-4 backdrop-blur-sm" onMouseDown={() => setIsRatioModalOpen(false)}>
          <div
            className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-pastel-border bg-white shadow-2xl dark:bg-[#11151c]"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-pastel-border px-5 py-4">
              <div className="flex items-center gap-2">
                <Maximize className="h-5 w-5 text-[#ed6d46]" />
                <h3 className="text-base font-black text-[#17243c] dark:text-white">画幅比例与分辨率设置</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRatioModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-pastel-bg text-pastel-muted hover:text-[#17243c]"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex flex-col gap-5 p-5">
              {/* Aspect Ratio */}
              <div>
                <label className="mb-2.5 block text-xs font-black text-[#17243c] dark:text-white">
                  1. 选择画幅比例 (Aspect Ratio)
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {ASPECT_OPTIONS.map((item) => {
                    const active = activeRecord.aspectRatio === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => patchActive({ aspectRatio: item.id })}
                        className={`flex min-h-16 flex-col items-center justify-center rounded-xl border p-2 text-center transition-all ${
                          active
                            ? 'border-[#ed6d46] bg-[#fff0e8] text-[#d8552e] font-black shadow-sm'
                            : 'border-pastel-border bg-white text-pastel-text hover:border-[#efb49d]'
                        }`}
                      >
                        <span className="text-xs font-black">{item.label}</span>
                        <span className={`mt-0.5 text-[10px] ${active ? 'text-[#d8552e]' : 'text-pastel-muted'}`}>{item.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Resolution */}
              <div>
                <label className="mb-2.5 block text-xs font-black text-[#17243c] dark:text-white">
                  2. 选择输出分辨率 (Resolution)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: ImageResolution.RES_1K, label: '1K', desc: '标准画质' },
                    { id: ImageResolution.RES_2K, label: '2K', desc: '高清推荐' },
                    { id: ImageResolution.RES_4K, label: '4K', desc: '超清印刷级' },
                  ].map((res) => {
                    const active = activeRecord.resolution === res.id;
                    return (
                      <button
                        key={res.id}
                        type="button"
                        onClick={() => patchActive({ resolution: res.id as ImageResolution })}
                        className={`flex min-h-14 flex-col items-center justify-center rounded-xl border p-2 text-center transition-all ${
                          active
                            ? 'border-[#ed6d46] bg-[#fff8f3] text-[#d8552e] font-black shadow-sm'
                            : 'border-pastel-border bg-white text-pastel-text hover:border-[#efb49d]'
                        }`}
                      >
                        <span className="text-xs font-black">{res.label}</span>
                        <span className={`mt-0.5 text-[10px] ${active ? 'text-[#d8552e]' : 'text-pastel-muted'}`}>{res.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <footer className="flex items-center justify-end border-t border-pastel-border px-5 py-3 bg-pastel-bg/30">
              <button
                type="button"
                onClick={() => setIsRatioModalOpen(false)}
                className="flex items-center gap-1.5 rounded-xl bg-[#17243c] px-6 py-2 text-xs font-black text-white hover:bg-[#253858] shadow-sm"
              >
                <Check className="h-4 w-4" /> 确定
              </button>
            </footer>
          </div>
        </div>
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
