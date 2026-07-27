import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  Eraser,
  Image as ImageIcon,
  Loader2,
  Maximize,
  Paintbrush,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  RotateCcw,
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
import { applyColorCorrection, ColorCorrectionMode, createModelHeadIdentityCrop, extractEdges } from '../utils/imageProcessor';
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
  transferSourceOutfit: boolean;
  outfitReason: string;
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

const ASPECT_OPTIONS = [
  { id: AspectRatio.SQUARE, label: '1:1', desc: '正方形' },
  { id: AspectRatio.PORTRAIT_2_3, label: '2:3', desc: '主图' },
  { id: AspectRatio.PORTRAIT_3_4, label: '3:4', desc: '详情' },
  { id: AspectRatio.PORTRAIT_9_16, label: '9:16', desc: '竖屏' },
  { id: AspectRatio.LANDSCAPE_16_9, label: '16:9', desc: '横屏' },
  { id: AspectRatio.LANDSCAPE_21_9, label: '21:9', desc: '超宽屏' },
];

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
  transferSourceOutfit: detectsSourceOutfitRequest(notes),
  outfitReason: detectsSourceOutfitRequest(notes) ? '用户补充要求提到了迁移源模特服装。' : '未明确要求迁移源模特服装，只进行高精度换脸。',
});

const buildAgentPrompt = (sourceCount: number, notes: string) => `
You are a fashion model transfer director.
Analyze source model images 1-${sourceCount} for facial geometry, features, complexion, and body structure.
Analyze target scene images for key light direction, shadow softness, and color temperature.
Decision rule: Determine if source outfit should be transferred based on user notes: "${notes || 'No extra notes'}".

Return valid JSON only:
{"identityBrief":"concise English identity lock","lightingBrief":"scene lighting notes","transferSourceOutfit":false,"outfitReason":"short Chinese reason"}
`.trim();

const parseAgentAnalysis = (text: string, notes: string): AgentAnalysis => {
  try {
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return fallbackAnalysis(notes);
    const parsed = JSON.parse(json);
    return {
      identityBrief: typeof parsed.identityBrief === 'string' && parsed.identityBrief.trim()
        ? parsed.identityBrief.trim()
        : fallbackAnalysis(notes).identityBrief,
      lightingBrief: typeof parsed.lightingBrief === 'string' && parsed.lightingBrief.trim()
        ? parsed.lightingBrief.trim()
        : fallbackAnalysis(notes).lightingBrief,
      transferSourceOutfit: Boolean(parsed.transferSourceOutfit),
      outfitReason: typeof parsed.outfitReason === 'string' ? parsed.outfitReason : '',
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
    ? `- INPAINTING MASK INSTRUCTION: The last image provided is the INPAINTING MASK. The WHITE region in the mask covers the target person's face and head. YOU MUST COMPLETELY ERASE AND REPLACE the face inside the WHITE mask region with the source model's face (from Image 1 & Image 2). Seamlessly blend skin tone, lighting highlights, and edge transitions with the rest of the target scene.`
    : `- Replace target person's face and identity completely with the source model. Seamlessly integrate lighting.`;

  const outfitRules = options.transferSourceOutfit
    ? `# SOURCE OUTFIT TRANSFER\n- Transfer the complete outfit from source model images to target pose. Adapt realistic folds and shadows.`
    : `# TARGET OUTFIT PRESERVATION\n- Keep target scene clothing and accessories unchanged. Perform face identity and skin tone transfer only.`;

  return `
# COMMERCIAL FASHION MODEL FACE SWAP & INPAINTING

# INPUT IMAGES REFERENCE:
- Image 1: Source Model Head Crop (Facial identity, eyes, nose, mouth, skin tone anchor)
- Image 2: Full Source Model Reference
- Image 3: Target Scene Base Image (Target person's body pose, background, camera angle, and scene atmosphere)
${options.hasMask ? '- Image 4: Face Inpainting Mask (WHITE = replace face; BLACK = keep background)' : ''}

# MANDATORY FACE REPLACEMENT RULES:
- Lock face features, eyes, nose, mouth, hairline, hairstyle, and complexion strictly from Image 1 & Image 2.
${maskText}

# LIGHTING & COMPOSITION INTEGRATION
- ${options.analysis.lightingBrief}
- Match key light direction, highlight softness, skin tone temperature, and cast shadows to the Target Scene.
${outfitRules}

# USER NOTES
${options.extraNotes || 'No extra notes.'}

# REJECT
blended original target face, target face leakage, unreplaced face, mismatched skin tone, red cast, floating face, unrealistic lighting, distorted face, dual faces.
`.trim();
};

const createDefaultFaceMaskDataUrl = (imageWidth: number, imageHeight: number): Promise<string> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = imageWidth;
    canvas.height = imageHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return resolve('');

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, imageWidth, imageHeight);

    const centerX = imageWidth * 0.5;
    const centerY = imageHeight * 0.35;
    const radiusX = imageWidth * 0.18;
    const radiusY = imageHeight * 0.22;

    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
    ctx.fill();

    resolve(canvas.toDataURL('image/png'));
  });
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
  aspectRatio: AspectRatio.PORTRAIT_3_4,
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
  onSave: (maskDataUrl: string) => void;
  onClose: () => void;
}> = ({ image, onSave, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [brushSize, setBrushSize] = useState<number>(35);
  const [brushOpacity, setBrushOpacity] = useState<number>(0.6);
  const [mode, setMode] = useState<'paint' | 'erase'>('paint');
  const [history, setHistory] = useState<ImageData[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });
  const imgRef = useRef<HTMLImageElement | null>(null);

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
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
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
        createDefaultFaceMaskDataUrl(img.naturalWidth, img.naturalHeight).then((dataUrl) => {
          if (!isMounted) return;
          const maskImg = new Image();
          maskImg.src = dataUrl;
          maskImg.onload = () => {
            if (!isMounted) return;
            ctx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
            saveState();
            setImgLoaded(true);
          };
          maskImg.onerror = () => {
            if (isMounted) setImgLoaded(true);
          };
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

  const handleAutoFaceMask = () => {
    if (!imgRef.current) return;
    createDefaultFaceMaskDataUrl(imgRef.current.naturalWidth, imgRef.current.naturalHeight).then((dataUrl) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        const maskImg = new Image();
        maskImg.src = dataUrl;
        maskImg.onload = () => {
          ctx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
          saveState();
        };
      }
    });
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

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { x, y } = getCanvasCoords(e);
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.globalAlpha = mode === 'paint' ? brushOpacity : 1.0;
    if (mode === 'paint') {
      ctx.fillStyle = 'white';
      ctx.strokeStyle = 'white';
    } else {
      ctx.fillStyle = 'black';
      ctx.strokeStyle = 'black';
    }

    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, 2 * Math.PI);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
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
      setCursorPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        visible: true,
      });
    } else {
      setCursorPos((prev) => ({ ...prev, visible: false }));
    }
  };

  const canvasRect = canvasRef.current?.getBoundingClientRect();
  const displayScale = canvasRect && canvasRef.current ? canvasRect.width / canvasRef.current.width : 1;
  const scaledBrushSize = brushSize * displayScale;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-[#10203a]/75 p-3 backdrop-blur-md" onMouseDown={onClose}>
      <section
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/40 bg-white shadow-2xl dark:bg-[#11151c]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex min-h-16 items-center justify-between border-b border-pastel-border px-5">
          <div className="flex items-center gap-2">
            <Paintbrush className="h-5 w-5 text-[#ed6d46]" />
            <h2 className="text-base font-black text-[#17243c] dark:text-white">涂抹目标场景人脸遮罩 (Face Masking)</h2>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl bg-pastel-bg text-pastel-muted hover:text-[#17243c]">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-pastel-border bg-[#f8fbff] px-5 py-3 dark:bg-black/20">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode('paint')}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition ${
                mode === 'paint' ? 'bg-[#ed6d46] text-white shadow-sm' : 'bg-white border border-pastel-border text-pastel-muted'
              }`}
            >
              <Paintbrush className="h-3.5 w-3.5" /> 涂抹人脸 (白色遮罩)
            </button>
            <button
              type="button"
              onClick={() => setMode('erase')}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition ${
                mode === 'erase' ? 'bg-[#17243c] text-white shadow-sm' : 'bg-white border border-pastel-border text-pastel-muted'
              }`}
            >
              <Eraser className="h-3.5 w-3.5" /> 橡皮擦 (擦除)
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-pastel-muted">粗细: {brushSize}px</span>
            <input
              type="range"
              min="10"
              max="120"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-20 accent-[#ed6d46]"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-pastel-muted">透明度: {Math.round(brushOpacity * 100)}%</span>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={brushOpacity}
              onChange={(e) => setBrushOpacity(Number(e.target.value))}
              className="w-20 accent-[#ed6d46]"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAutoFaceMask}
              className="flex items-center gap-1 rounded-xl border border-orange-200 bg-[#fff8f3] px-2.5 py-1.5 text-xs font-bold text-[#d8552e] hover:bg-[#fff0e8]"
            >
              <Sparkles className="h-3.5 w-3.5" /> 智能预设人脸圈选
            </button>
            <button
              type="button"
              onClick={handleUndo}
              disabled={history.length <= 1}
              className="flex items-center gap-1 rounded-xl border border-pastel-border bg-white px-2.5 py-1.5 text-xs font-bold text-pastel-muted hover:bg-pastel-bg disabled:opacity-40"
            >
              <Undo className="h-3.5 w-3.5" /> 撤销
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100"
            >
              <Trash2 className="h-3.5 w-3.5" /> 清空
            </button>
          </div>
        </div>

        <div
          ref={containerRef}
          onMouseMove={handleMouseMoveWrapper}
          onMouseLeave={() => setCursorPos((prev) => ({ ...prev, visible: false }))}
          className="relative flex flex-1 items-center justify-center overflow-auto bg-[#eef5fd] p-4 min-h-[400px]"
        >
          <div className="relative inline-block border border-pastel-border shadow-lg rounded-xl overflow-hidden max-h-[560px] cursor-none">
            <img src={getDataUrl(image)} alt="Scene Target" className="block max-h-[560px] max-w-full object-contain pointer-events-none" />
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
                className={`pointer-events-none absolute rounded-full border-2 shadow-xl -translate-x-1/2 -translate-y-1/2 z-30 ${
                  mode === 'paint' ? 'border-[#ed6d46] bg-[#ed6d46]/30' : 'border-slate-900 bg-slate-900/40'
                }`}
                style={{
                  left: `${cursorPos.x}px`,
                  top: `${cursorPos.y}px`,
                  width: `${scaledBrushSize}px`,
                  height: `${scaledBrushSize}px`,
                }}
              />
            )}
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-pastel-border px-5 py-3 bg-white dark:bg-[#11151c]">
          <p className="text-xs text-pastel-muted">
            💡 <strong>涂抹提示:</strong> 用画笔涂满目标场景图中需要被替换的人脸与头部，白色区域为 AI 替换靶区。
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-pastel-border px-4 py-2 text-xs font-bold text-pastel-muted">
              取消
            </button>
            <button type="button" onClick={handleSave} className="flex items-center gap-1.5 rounded-xl bg-[#17243c] px-5 py-2 text-xs font-black text-white hover:bg-[#253858]">
              <Check className="h-4 w-4" /> 保存涂抹蒙版
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

  const activeUploadKindRef = useRef<UploadKind>('model');
  const modelInputRef = useRef<HTMLInputElement>(null);
  const sceneInputRef = useRef<HTMLInputElement>(null);

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
        const maskDataUrl = await createDefaultFaceMaskDataUrl(1024, 1024);
        return { ...sc, maskDataUrl };
      }));
      patchActive({ targetScenes: [...activeRecord.targetScenes, ...scenesWithMasks].slice(0, MAX_SCENE_IMAGES) });
    }

    patchActive({ error: null });
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

      const analysis = parseAgentAnalysis(text, activeRecord.extraNotes);
      patchActive({
        agentAnalysis: analysis,
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
        const updatedResults = exists
          ? rec.results.map((item) => (item.sceneId === sceneId ? { ...item, ...patch } : item))
          : [...rec.results, { id: `result-${sceneId}`, sceneId, sceneName: '', imageUrl: null, status: 'pending', prompt: '', ...patch }];
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
      ...identityAnchors,
      ...sources.map(toApiImage),
      toApiImage(prepared.scene),
    ];
    if (prepared.maskAnchor) inputImages.push(prepared.maskAnchor);

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
    const formattedImage = await convertImageDataUrlFormat(correctedImage, activeRecord.outputFormat);
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

      <div className="mt-3 flex-1 space-y-2 overflow-y-auto custom-scrollbar pr-1">
        {records.map((rec) => {
          const isCurrentRec = rec.id === activeRecord.id;

          return (
            <button
              key={rec.id}
              type="button"
              onClick={() => {
                if (!isGenerating) {
                  setActiveRecordId(rec.id);
                }
              }}
              className={`group relative w-full overflow-hidden rounded-xl border p-3 text-left transition ${
                isCurrentRec
                  ? 'border-[#ed6d46] bg-[#fff8f3] shadow-sm'
                  : 'border-pastel-border bg-pastel-bg/40 hover:border-[#efb49d]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="truncate text-xs font-black text-[#17243c] dark:text-white">
                  {rec.sourceModels[0]?.name || '未命名模特'}
                </span>
                <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[0.62rem] font-bold text-pastel-muted">
                  {STEPS.find((item) => item.id === rec.step)?.label}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[0.68rem] text-pastel-muted">
                <span>{rec.targetScenes.length} 个场景图</span>
                <span>{new Date(rec.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  deleteRecord(rec.id);
                }}
                className="absolute bottom-2 right-2 hidden h-7 w-7 items-center justify-center rounded-lg bg-white text-red-400 shadow group-hover:flex"
                aria-label="删除记录"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </span>
            </button>
          );
        })}
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

        <div className={`grid grid-cols-1 gap-3 ${isModel ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
          {images.map((image, index) => (
            <div key={image.id} className="relative overflow-hidden rounded-xl border border-pastel-border bg-pastel-bg/30 flex flex-col">
              <div className="aspect-[4/3] overflow-hidden bg-white relative">
                <img src={image.preview} alt={isModel ? `模特${MODEL_SLOTS[index]}` : `目标场景${index + 1}`} className="h-full w-full object-contain" />
                {!isModel && image.maskDataUrl && (
                  <span className="absolute top-2 left-2 rounded-full bg-[#ed6d46] text-white px-2 py-0.5 text-[0.65rem] font-black flex items-center gap-1 shadow">
                    <Check className="h-3 w-3" /> 已含人脸遮罩
                  </span>
                )}
              </div>

              <div className="flex min-h-11 items-center justify-between gap-2 border-t border-pastel-border px-3 bg-white dark:bg-[#11151c]">
                <span className="truncate text-xs font-bold text-pastel-text dark:text-white">{isModel ? MODEL_SLOTS[index] : `场景 ${index + 1}`}</span>

                <div className="flex items-center gap-1">
                  {!isModel && (
                    <button
                      type="button"
                      onClick={() => setMaskEditingImage(image)}
                      disabled={isGenerating}
                      className="flex items-center gap-1 rounded-lg border border-orange-200 bg-[#fff8f3] px-2 py-1 text-[0.68rem] font-black text-[#d8552e] hover:bg-[#fff0e8]"
                      title="涂抹人脸区域"
                    >
                      <Paintbrush className="h-3.5 w-3.5" /> 涂抹人脸
                    </button>
                  )}
                  <button type="button" onClick={() => removeUploadedImage(kind, image.id)} disabled={isGenerating} className="flex h-8 w-8 items-center justify-center rounded-lg text-pastel-muted hover:bg-red-50 hover:text-red-500 disabled:opacity-40" aria-label="删除图片">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {images.length < max ? (
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
        

        {/* Top Hero Banner */}
        <section className="relative overflow-hidden rounded-3xl border border-[#d8e3ee] bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#11151c]">
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-[#fff0e8]/80 blur-2xl pointer-events-none" />
          <div className="relative flex flex-col items-center text-center">
            <span className="flex items-center gap-1.5 rounded-full bg-[#fff0e8] px-3 py-1 text-xs font-black text-[#ed6d46]">
              <Sparkles className="h-3.5 w-3.5" /> AI 模特视觉 Agent
            </span>
            <h2 className="mt-2 text-xl font-black text-[#17243c] dark:text-white">
              高精模特并发迁移与人脸融合
            </h2>
            <p className="mt-1 text-xs text-pastel-muted">
              用最多三张多角度参考锁定同一模特的完整样貌，结合目标场景图人脸涂抹遮罩与 Agent 把关，实现最完美的光影融合与模特无缝换脸。
            </p>

            <WorkflowSteps step={activeRecord.step} />
          </div>
        </section>

        {/* Floating Bottom-Left Collapsed Record Button (Matches SceneGenerationTab 1:1) */}
        {!isHistoryOpen && (
          <button
            type="button"
            onClick={() => setIsHistoryOpen(true)}
            className="fixed bottom-5 left-4 z-40 flex min-h-12 items-center gap-2 rounded-full border border-pastel-border bg-white px-4 text-sm font-black shadow-[0_8px_24px_rgba(30,50,80,0.16)] xl:left-24 dark:bg-[#11151c] dark:border-white/10 dark:text-white"
          >
            <PanelLeftOpen className="h-4 w-4 text-[#ed6d46]" />
            生成记录
            <span className="rounded-full bg-pastel-bg px-2 py-1 text-xs text-pastel-muted dark:bg-white/10">{records.length}</span>
          </button>
        )}

        {/* Main 3-Column Grid Layout */}
        <div className={`grid grid-cols-1 gap-6 lg:grid-cols-12`}>
          
          {/* Left Column: History Panel */}
          {isHistoryOpen && (
            <div className="col-span-12 lg:col-span-3">
              {historyPanel}
            </div>
          )}

          {/* Middle Column: Controls Panel */}
          <div className={`col-span-12 ${isHistoryOpen ? 'lg:col-span-4' : 'lg:col-span-5'} flex flex-col gap-4`}>
            {renderUploadArea('model')}
            {renderUploadArea('scene')}

            {/* Model & Generation Parameters */}
            <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c] sm:p-5">
              <div className="mb-4 flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-[#ed6d46]" />
                <h3 className="text-sm font-black text-[#17243c] dark:text-white">生成模型</h3>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {MODEL_OPTIONS.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => patchActive({ selectedModel: model.id })}
                    disabled={isGenerating}
                    className={`relative flex min-h-20 flex-col items-center justify-center rounded-2xl border-2 p-3 transition-all ${
                      activeRecord.selectedModel === model.id ? 'border-[#ed6d46] bg-gradient-to-br from-[#fff7f2] to-[#eef5ff] text-[#d8552e]' : 'border-pastel-border bg-white text-pastel-text hover:border-[#efb49d]'
                    }`}
                  >
                    <Zap className="absolute left-3 top-3 h-4 w-4 text-[#ed6d46]" />
                    <span className="text-xs font-black">{model.label}</span>
                    <span className="mt-1 text-xs opacity-70">{model.desc}</span>
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-black text-pastel-muted">服装策略</span>
                  <span className="rounded-full bg-[#fff0e8] px-2.5 py-1 text-xs font-black text-[#d8552e]">{effectiveOutfitLabel}</span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {OUTFIT_OPTIONS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => patchActive({ outfitMode: item.id })}
                      disabled={isGenerating}
                      className={`min-h-16 rounded-xl border px-3 py-2 text-left transition ${
                        activeRecord.outfitMode === item.id ? 'border-[#ed6d46] bg-[#fff8f3] text-[#d8552e]' : 'border-pastel-border bg-white text-pastel-text'
                      }`}
                    >
                      <span className="block text-xs font-black">{item.label}</span>
                      <span className="mt-1 block text-xs opacity-70">{item.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={activeRecord.extraNotes}
                onChange={(event) => patchActive({ extraNotes: event.target.value })}
                disabled={isGenerating}
                placeholder="补充要求，例如：保持人脸轮廓光滑，适应黄昏冷暖感光影..."
                className="mt-4 min-h-24 w-full resize-y rounded-xl border border-pastel-border bg-pastel-bg px-3 py-3 text-sm outline-none focus:border-[#ed6d46]"
              />
            </section>

            {/* Aspect Ratio */}
            <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c] sm:p-5">
              <div className="mb-4 flex items-center gap-2">
                <Maximize className="h-5 w-5 text-[#ed6d46]" />
                <h3 className="text-sm font-black text-[#17243c] dark:text-white">画幅比例与分辨率</h3>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {ASPECT_OPTIONS.map((item) => {
                  const active = activeRecord.aspectRatio === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => patchActive({ aspectRatio: item.id })}
                      disabled={isGenerating}
                      className={`flex min-h-[3.25rem] flex-col items-center justify-center rounded-xl border px-2 py-2 text-center transition-all disabled:opacity-50 ${
                        active
                          ? 'border-[#ed6d46] bg-[#fff0e8] text-[#d8552e]'
                          : 'border-pastel-border bg-white text-pastel-muted hover:border-[#efb49d]'
                      }`}
                    >
                      <span className="text-xs font-black">{item.label}</span>
                      <span className={`mt-0.5 text-[10px] ${active ? 'text-[#d8552e]' : 'text-gray-300'}`}>{item.desc}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3">
                <span className="text-xs font-black text-pastel-muted">分辨率</span>
                <select
                  value={activeRecord.resolution}
                  onChange={(event) => patchActive({ resolution: event.target.value as ImageResolution })}
                  disabled={isGenerating}
                  className="mt-1 min-h-11 w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-sm font-black text-pastel-text outline-none focus:border-[#ed6d46]"
                >
                  <option value={ImageResolution.RES_1K}>1K</option>
                  <option value={ImageResolution.RES_2K}>2K (默认)</option>
                  <option value={ImageResolution.RES_4K}>4K</option>
                </select>
              </div>
            </section>

            {/* Color Correction */}
            <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c] sm:p-5">
              <div className="mb-3 flex items-center gap-2">
                <Sun className="h-5 w-5 text-[#ed6d46]" />
                <h3 className="text-sm font-black text-[#17243c] dark:text-white">色彩修正</h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['off', 'match', 'autoWhiteBalance', 'redSuppress'] as ColorCorrectionMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => patchActive({ colorCorrectionMode: mode })}
                    disabled={isGenerating}
                    className={`min-h-11 rounded-xl border px-2 text-xs font-black ${
                      activeRecord.colorCorrectionMode === mode ? 'border-[#ed6d46] bg-[#fff0e8] text-[#d8552e]' : 'border-pastel-border text-pastel-muted'
                    }`}
                  >
                    {({ off: '关闭修正', match: '匹配各场景', autoWhiteBalance: '自动白平衡', redSuppress: '压红补青' } as Record<ColorCorrectionMode, string>)[mode]}
                  </button>
                ))}
              </div>
            </section>

            {/* One-Click Toggle */}
            <label className="flex min-h-14 cursor-pointer items-center justify-between rounded-2xl border border-pastel-border bg-white px-4 shadow-sm dark:bg-[#11151c]">
              <span>
                <strong className="block text-xs font-black text-[#17243c] dark:text-white">一键全流程自动迁移</strong>
                <small className="mt-0.5 block text-[0.68rem] text-pastel-muted">开启后跳过 Agent 分步确认，自动连续完成分析与迁移</small>
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
                  className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#ed6d46] text-sm font-black text-white shadow-[0_14px_28px_rgba(237,109,70,0.2)] transition hover:-translate-y-0.5"
                >
                  <span>确认分析，下一步：涂抹/检查人脸蒙版</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void runStep1_Analyze()}
                  className="min-h-10 rounded-xl border border-pastel-border text-xs font-black text-pastel-muted hover:bg-pastel-bg"
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
            
            {/* Agent Checkpoint Status Banner */}
            {!isGenerating && activeRecord.checkpoint !== 'input' && activeRecord.checkpoint !== 'complete' && (
              <section className="rounded-2xl border border-[#f0d8c9] bg-[#fffaf6] p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[0.68rem] font-black tracking-[0.14em] text-[#ed6d46]">AGENT CHECKPOINT</span>
                    <h3 className="mt-0.5 text-base font-black text-[#17243c]">
                      {activeRecord.checkpoint === 'analyzed' && 'Agent 已锁定模特基因与目标光影'}
                      {activeRecord.checkpoint === 'masked' && 'Agent 人脸涂抹遮罩已就绪'}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-pastel-muted">
                      {activeRecord.checkpoint === 'analyzed' && (activeRecord.agentAnalysis?.identityBrief || '已综合模特五官特征与场景氛围。请点击“涂抹人脸”微调原脸替换蒙版。')}
                      {activeRecord.checkpoint === 'masked' && '遮罩可 100% 隔离目标原脸干扰，AI 将在涂抹区域融合极致光影并进行换脸。'}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#fff0e8] px-3 py-1 text-xs font-black text-[#d8552e] shrink-0">
                    待确认把关
                  </span>
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
                  <div className="no-scrollbar grid w-full grid-cols-1 content-start gap-4 overflow-y-auto p-2 sm:grid-cols-2">
                    {activeRecord.results.map((item, index) => (
                      <article key={item.sceneId} className="group relative overflow-hidden rounded-2xl border border-pastel-border bg-white shadow-md">
                        <div className="relative flex min-h-56 aspect-[3/4] items-center justify-center overflow-hidden bg-white">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={`模特迁移 ${index + 1}`} className="h-full w-full object-contain cursor-zoom-in" onClick={() => setSelectedPreview(item.imageUrl!)} />
                          ) : item.status === 'error' || item.status === 'cancelled' ? (
                            <div className="p-5 text-center text-sm font-bold text-red-500">{item.error || statusLabel(item.status)}</div>
                          ) : (
                            <div className="flex flex-col items-center gap-3 p-5 text-center text-[#ed6d46]">
                              <Loader2 className={`h-7 w-7 ${item.status !== 'pending' ? 'animate-spin' : ''}`} />
                              <span className="text-sm font-bold">{statusLabel(item.status)}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex min-h-14 items-center justify-between gap-2 border-t border-pastel-border px-3">
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
                </div>
                {isGenerating && statusMessage ? <p className="mt-3 text-center text-xs font-bold text-[#d8552e]">{statusMessage}</p> : null}
              </section>
            )}
          </div>

        </div>
      </div>

      {/* Face Masking Canvas Modal */}
      {maskEditingImage && (
        <FaceMaskModal
          image={maskEditingImage}
          onSave={(maskDataUrl) => handleSaveMask(maskEditingImage.id, maskDataUrl)}
          onClose={() => setMaskEditingImage(null)}
        />
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
