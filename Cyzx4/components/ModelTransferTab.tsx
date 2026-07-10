import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Image as ImageIcon,
  Loader2,
  Maximize,
  RefreshCw,
  Sparkles,
  Sun,
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

type UploadKind = 'model' | 'scene' | 'color';

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
  error?: string;
};

const MODEL_OPTIONS = [
  { id: 'gemini-3.1-flash-image-preview', label: 'Banana 2', desc: '3.1 Flash', icon: <Zap className="h-4 w-4 text-orange-500" /> },
  { id: 'gemini-3-pro-image-preview', label: 'Banana Pro', desc: '3 Pro', icon: <Zap className="h-4 w-4 text-orange-500" /> },
  { id: 'gpt-image-2', label: 'GPT Image 2', desc: 'Ultra Quality', icon: <Sparkles className="h-4 w-4 text-orange-500" /> },
];

const ASPECT_OPTIONS = [
  { id: AspectRatio.PORTRAIT_3_4, label: '3:4', desc: '详情竖图' },
  { id: AspectRatio.PORTRAIT_2_3, label: '2:3', desc: '海报竖图' },
  { id: AspectRatio.PORTRAIT_4_5, label: '4:5', desc: '社媒主图' },
  { id: AspectRatio.SQUARE, label: '1:1', desc: '方图' },
  { id: AspectRatio.LANDSCAPE_16_9, label: '16:9', desc: '横版场景' },
];

const getDataUrl = (image: UploadedImage) => `data:${image.mime};base64,${image.base64}`;
const toApiImage = (image: UploadedImage) => ({ base64: image.base64, mimeType: image.mime });
const dataUrlToApiImage = (dataUrl: string) => {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
  return {
    base64: match ? match[2] : dataUrl,
    mimeType: match ? match[1] : 'image/jpeg',
  };
};

const buildFallbackBrief = () => `
Source model face identity lock:
- Preserve ONLY the source model's facial identity: face shape, eyes, nose, lips, eyebrows, facial feature spacing, expression character, hairline/visible hair identity, complexion, age impression, and recognizable person likeness.
- Do NOT transfer the source model's outfit, garment color, fabric, pattern, bag, jewelry, shoes, accessories, pose, silhouette, or styling.

Target scene transfer:
- Preserve the target scene image as the base: target clothing, garment color, garment structure, bag, accessories, pose, gesture, angle, proportions, camera height, lens distance, crop, framing, background/location, wall/floor/material details, light direction, highlight/shadow layout, color temperature, contrast, and realistic face/fabric light response.

Forbidden:
- Do not copy the target scene person's identity or face.
- Do not replace or blend the target clothing with the source clothing. Do not copy the source outfit, source bag, source shoes, source jewelry, source garment texture, or source styling.
- Do not create two people, collage, split screen, face drift, target outfit change, red skin cast, plastic skin, waxy skin, or CGI look.
`.trim();

const buildAgentPrompt = (extraNotes: string) => `
You are a senior fashion photography transfer director.

Analyze Image 1 and Image 2, then write a concise production brief for an image generation model.

IMAGE MAPPING:
- Image 1 = source model. It is ONLY the facial identity / head likeness source.
- Image 2 = target scene. It is the base image source for everything except the target person's face: clothing, accessories, pose, action, camera, crop, scene, lighting, shadow, and color temperature.

Return plain English only with these sections:
1. Source model face identity locks
2. Target scene clothing, pose, camera, background, and lighting preservation
3. Absolute forbidden changes

User notes:
${extraNotes || 'No extra user notes.'}
`.trim();

const buildTransferPrompt = (options: {
  outputNumber: number;
  agentBrief: string;
  extraNotes: string;
}) => `
Create ONE photorealistic commercial fashion image for model transfer output #${options.outputNumber}.

# IMAGE ROUTING
- Images 1 and 2 are duplicated SOURCE FACE CLOSE-UP anchors. They have the highest priority for the new facial identity / head likeness: face shape, facial structure, eyes, nose, lips, eyebrows, facial feature spacing, expression character, hairline/visible hair identity, complexion, age impression, and recognizable person likeness.
- Image 3 is the TARGET SCENE original and the base canvas. Preserve its background/location, wall color, wall texture, floor, camera perspective, crop, subject scale, light direction, cast-shadow geometry, contact shadows, highlight placement, facial lighting layout, color temperature, contrast, natural photographic atmosphere, target outfit, target garment color, target garment construction, target bag, target shoes, target jewelry, target accessories, and target pose. Replace only the target person's face/head identity. Do NOT repaint, redesign, recolor, blur, simplify the background, or change the outfit.
- Image 4 is a black-and-white lineart/silhouette extracted from the target scene. It is POSE GEOMETRY ONLY: copy outline, head angle, shoulder slope, torso lean, arm/hand placement, leg stance, crop, camera distance, and subject placement. It contains no usable identity, face, hair, clothing, color, or texture.
- Image 5 is the SOURCE MODEL context image. Use it only to reinforce the same source facial identity when needed. It must NOT provide clothing, outfit, garment, bag, shoes, jewelry, accessories, pose, silhouette, or styling.

# DIRECTOR AGENT BRIEF
${options.agentBrief}

# NON-NEGOTIABLE FACE IDENTITY TRANSPLANT LOCK
- The final face/head must look like the exact same person as Images 1 and 2.
- Preserve Images 1 and 2's face shape, eyes, nose, lips, eyebrows, facial feature spacing, expression character, hairline/visible hair identity, complexion, age impression, and recognizable person identity.
- SOURCE FACE CLOSE-UP PRIORITY: Images 1 and 2 outrank Image 3's original target face. If the generated result still resembles the target-scene face more than Images 1 and 2, treat it as failed and regenerate internally with stronger source-face identity.
- Transfer ONLY the source model's facial identity onto the target-scene person. This is a face/head identity replacement, not an outfit transfer and not a full-body model swap.
- Do NOT preserve Image 5's outfit, garment silhouette, garment color, fabric, pattern, seams, neckline, waist details, hem, shoes, bag, jewelry, accessories, pose, silhouette, or styling.
- Do not borrow Image 3's original target face or identity, but keep Image 3's target clothing, bag, shoes, accessories, pose, and scene.

# TARGET SCENE, POSE AND LIGHTING TRANSFER
- Perform an in-place face/head identity replacement inside Image 3: keep the target clothing, bag, shoes, accessories, hands, arms, proportions, pose, wall color, texture, shadow pattern, floor, crop, camera angle, and background placement from Image 3 unchanged.
- Rebuild only the target person's face/head likeness using Images 1 and 2, fitted naturally onto Image 3's existing pose, clothing, and lighting as if photographed in the same real shoot.
- COPY the target pose from Image 4's lineart/silhouette: head tilt, chin angle, shoulder slope, torso lean, hip position, arm bend, hand placement, leg stance, body crop, subject scale, and left/right placement. Do not default to the source model's straight catalog pose.
- COPY the target scene lighting from Image 3: hard/soft light quality, key-light direction, shadow side of the face, nose/neck shadow, arm shadow, garment highlight placement, existing wall cast shadows, contact shadow, contrast level, and warm/cool balance.
- FACE LIGHTING MUST BE SCENE-EXACT: preserve the same facial light/shadow map that exists on Image 3's target-scene person at the corresponding head position. Do not add new beauty light, fill light, rim light, catchlight, cheek highlight, forehead highlight, nose highlight, dappled shadow, leaf shadow, dramatic shadow, studio glow, or cinematic relighting unless it is already visible in Image 3 at that face area.
- Do not invent extra facial shadows or decorative light patterns. If Image 3 has flat soft light on the face, keep it flat and soft. If Image 3 has hard sun/shadow on the face, copy only that existing direction, shape, density, and edge softness.
- Keep Image 3's target outfit physically intact. The target clothes must not become the source context image's clothes, colors, textures, patterns, or accessories.
- Make the face realistically lit by Image 3's exact existing light field while still preserving Images 1 and 2's identity.
- UNCHANGED TARGET REJECTION RULE: returning Image 3 unchanged, or preserving Image 3's original target face, is a failed result.

# COLOR AND REALISM
- Use realistic editorial fashion photography, natural face detail, believable fabric response, accurate environmental shadows, and no synthetic smoothing.
- Avoid the common Gemini red cast. Keep complexion neutral and healthy, preserve the intended warm/cool balance from Image 1, and do not over-saturate reds.

# USER NOTES
${options.extraNotes || 'No extra notes.'}

# NEGATIVE
different source person, identity drift, source face changed, source facial features lost, target-scene face copied, target identity retained, source catalog pose copied, source silhouette copied, source outfit copied, source garment copied, source dress copied, source shirt copied, source bag copied, source shoes copied, source jewelry copied, source accessories copied, source styling copied, target outfit changed, target clothing changed, target bag changed, target shoes changed, target jewelry changed, target accessories changed, wrong target garment color, wrong target garment pattern, wrong target fabric, missing target bag, missing target shoes, missing target jewelry, pose not copied, head tilt missing, shoulder slope missing, arm placement changed, hand placement changed, lean missing, camera crop changed, background repainted, wall color changed, wall texture changed, missing wall cast shadows, shadow pattern changed, lighting not copied, flat studio lighting, beauty dish lighting, artificial fill light, added face light, added facial highlight, new cheek highlight, new forehead highlight, new nose highlight, extra catchlight, invented dappled face shadow, decorative facial shadow, dramatic facial shadow, added leaf shadow, added palm shadow, added foliage shadow, plant shadow, tree branch shadow, tropical leaf pattern, wrong shadow direction, missing facial shadow, pasted cutout, floating subject, no contact shadow, complexion changed, two people, duplicate person, collage, split screen, mismatched shadows, mismatched lighting, red cast, oversaturated red, plastic texture, waxy face, doll-like face, CGI, 3d render, over-smoothed face, distorted hands, broken limbs, bad anatomy, text, watermark, logo, blurry face.
`.trim();

const getResultAspectClass = (ratio: AspectRatio) => {
  if (ratio === AspectRatio.SQUARE) return 'aspect-square';
  if (ratio === AspectRatio.PORTRAIT_2_3) return 'aspect-[2/3]';
  if (ratio === AspectRatio.PORTRAIT_3_4) return 'aspect-[3/4]';
  if (ratio === AspectRatio.PORTRAIT_4_5) return 'aspect-[4/5]';
  if (ratio === AspectRatio.LANDSCAPE_16_9) return 'aspect-video';
  return 'aspect-[3/4]';
};

const UploadCard: React.FC<{
  title: string;
  desc: string;
  icon: React.ReactNode;
  image: UploadedImage | null;
  isActive: boolean;
  pasteHint: string;
  onUpload: (files: File[]) => void;
  onRemove: () => void;
  onActivate: () => void;
}> = ({ title, desc, icon, image, isActive, pasteHint, onUpload, onRemove, onActivate }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (files?: FileList | File[] | null) => {
    if (files) onUpload(Array.from(files).filter((item) => item.type.startsWith('image/')));
  };

  return (
    <section className={`rounded-2xl border bg-white p-5 shadow-sm transition-all ${isActive ? 'border-orange-200 ring-2 ring-orange-100' : 'border-pastel-border'}`}>
      <div className="mb-3 flex items-start gap-2">
        <div className="mt-0.5 text-pastel-highlight">{icon}</div>
        <div>
          <h3 className="text-sm font-bold text-pastel-text">{title}</h3>
          <p className="mt-0.5 text-[10px] leading-relaxed text-pastel-muted">{desc}</p>
        </div>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          onActivate();
          inputRef.current?.click();
        }}
        onMouseEnter={onActivate}
        onMouseMove={onActivate}
        onPointerEnter={onActivate}
        onPointerMove={onActivate}
        onFocus={onActivate}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onActivate();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          onActivate();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          onActivate();
          handleFiles(event.dataTransfer.files);
        }}
        className={`min-h-[14rem] cursor-pointer rounded-xl border-2 border-dashed p-3 outline-none transition-all ${
          isDragging || isActive ? 'border-pastel-highlight bg-orange-50/60' : 'border-pastel-border bg-pastel-bg/30 hover:border-orange-200'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = '';
          }}
        />
        {image ? (
          <div className="group relative h-full min-h-[12rem] overflow-hidden rounded-lg border border-pastel-border bg-white">
            <img src={image.preview} alt={title} className="h-full max-h-[22rem] w-full object-contain" />
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRemove();
              }}
              className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
              aria-label={`Remove ${title}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex min-h-[12rem] flex-col items-center justify-center text-center">
            <Upload className="mb-2 h-8 w-8 text-pastel-muted" />
            <p className="mb-1 text-[10px] font-bold text-orange-500">{pasteHint}</p>
            <p className="text-xs font-bold text-pastel-text">拖拽图片到这里</p>
            <p className="mt-1 text-[10px] text-pastel-muted">或点击选择文件，支持 JPG / PNG / WebP</p>
          </div>
        )}
      </div>
    </section>
  );
};

const ModelTransferTab: React.FC = () => {
  const [sourceModel, setSourceModel] = useState<UploadedImage | null>(null);
  const [targetScene, setTargetScene] = useState<UploadedImage | null>(null);
  const [colorReference, setColorReference] = useState<UploadedImage | null>(null);
  const [activeUploadKind, setActiveUploadKind] = useState<UploadKind | null>(null);
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-image-preview');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.PORTRAIT_3_4);
  const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.RES_2K);
  const [generateCount, setGenerateCount] = useState(1);
  const [outputFormat, setOutputFormat] = useState<OutputImageFormat>('jpg');
  const [colorCorrectionMode, setColorCorrectionMode] = useState<ColorCorrectionMode>('match');
  const [colorCorrectionBlend, setColorCorrectionBlend] = useState(0.55);
  const [extraNotes, setExtraNotes] = useState('');
  const [agentBrief, setAgentBrief] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const hoveredUploadKindRef = useRef<UploadKind | null>(null);
  const {
    cancelMessage,
    startGenerationTask,
    cancelGenerationTask,
    isCurrentGenerationTask,
    assertCurrentGenerationTask,
    finishGenerationTask,
  } = useCancelableGeneration();

  const canGenerate = !!sourceModel && !!targetScene && !isGenerating;
  const outputCountLabel = useMemo(() => `${generateCount} 张`, [generateCount]);

  const setSingleImage = async (
    files: File[],
    setter: React.Dispatch<React.SetStateAction<UploadedImage | null>>
  ) => {
    const file = files.find((item) => item.type.startsWith('image/'));
    if (!file) return;
    const compressed = await compressImage(file, 1800, 0.92);
    setter((prev) => {
      if (prev?.preview.startsWith('blob:')) URL.revokeObjectURL(prev.preview);
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        preview: URL.createObjectURL(file),
        base64: compressed.base64,
        mime: compressed.mime,
      };
    });
    setError('');
  };

  const activateUploadKind = useCallback((kind: UploadKind) => {
    hoveredUploadKindRef.current = kind;
    setActiveUploadKind(kind);
  }, []);

  const handlePastedImages = useCallback((files: File[]) => {
    if (!files.some((item) => item.type.startsWith('image/'))) return;
    const targetKind = hoveredUploadKindRef.current ?? activeUploadKind ?? (!sourceModel ? 'model' : !targetScene ? 'scene' : 'model');
    if (targetKind === 'model') {
      setSingleImage(files, setSourceModel);
    } else if (targetKind === 'scene') {
      setSingleImage(files, setTargetScene);
    } else {
      setSingleImage(files, setColorReference);
    }
  }, [activeUploadKind, sourceModel, targetScene]);

  useImagePaste(handlePastedImages, !isGenerating);

  const removeImage = (kind: UploadKind) => {
    const clear = (setter: React.Dispatch<React.SetStateAction<UploadedImage | null>>) => {
      setter((prev) => {
        if (prev?.preview.startsWith('blob:')) URL.revokeObjectURL(prev.preview);
        return null;
      });
    };
    if (kind === 'model') clear(setSourceModel);
    if (kind === 'scene') clear(setTargetScene);
    if (kind === 'color') clear(setColorReference);
  };

  const buildAnalysisBrief = async (signal: AbortSignal) => {
    if (!sourceModel || !targetScene) return buildFallbackBrief();
    try {
      setStatusMessage('迁移导演 Agent 正在分析身份、姿态和光影...');
      const text = await generateText(
        [toApiImage(sourceModel), toApiImage(targetScene)],
        buildAgentPrompt(extraNotes),
        'gemini-3.1-flash-lite-preview'
      );
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      return text.trim() || buildFallbackBrief();
    } catch (briefError) {
      if (isAbortError(briefError)) throw briefError;
      console.warn('Model transfer agent analysis failed. Falling back to built-in brief.', briefError);
      return buildFallbackBrief();
    }
  };

  const generateOne = async (index: number, brief: string, signal: AbortSignal): Promise<ResultItem> => {
    if (!sourceModel || !targetScene) throw new Error('请先上传我的模特图和目标场景图。');
    const prompt = buildTransferPrompt({
      outputNumber: index + 1,
      agentBrief: brief,
      extraNotes,
    });
    setStatusMessage('正在提取目标场景姿态线稿，避免复制目标人脸...');
    const poseLineartAnchor = dataUrlToApiImage(await extractEdges(getDataUrl(targetScene)));
    const sourceFaceAnchor = dataUrlToApiImage(await createModelHeadIdentityCrop(getDataUrl(sourceModel)));
    const sceneAnchor = toApiImage(targetScene);
    const modelAnchor = toApiImage(sourceModel);
    const [rawImage] = await generateImageToImage([sourceFaceAnchor, sourceFaceAnchor, sceneAnchor, poseLineartAnchor, modelAnchor], prompt, {
      aspectRatio,
      resolution,
      modelId: selectedModel,
      workflowHint: 'model-transfer',
      hasModelRef: true,
      signal,
    });
    if (!rawImage) throw new Error('模型未返回图片。');
    const correctedImage = await applyColorCorrection(rawImage, {
      mode: colorCorrectionMode,
      reference: colorCorrectionMode === 'match'
        ? getDataUrl(colorReference || targetScene)
        : undefined,
      blend: colorCorrectionBlend,
    });
    const formattedImage = await convertImageDataUrlFormat(correctedImage, outputFormat);
    return {
      id: `${Date.now()}-${index}`,
      imageUrl: formattedImage,
      status: 'done',
      prompt,
    };
  };

  const handleGenerate = async () => {
    if (!sourceModel) {
      setError('请先上传我的模特图。');
      return;
    }
    if (!targetScene) {
      setError('请先上传目标场景图。');
      return;
    }

    setError('');
    setAgentBrief('');
    const { taskId, signal } = startGenerationTask();
    setIsGenerating(true);
    setResults(Array.from({ length: generateCount }, (_, index) => ({
      id: `pending-${index}`,
      imageUrl: null,
      status: 'pending',
      prompt: '',
    })));

    const generated: ResultItem[] = [];
    try {
      const brief = await buildAnalysisBrief(signal);
      assertCurrentGenerationTask(taskId, signal);
      setAgentBrief(brief);

      for (let index = 0; index < generateCount; index += 1) {
        assertCurrentGenerationTask(taskId, signal);
        setStatusMessage(`正在生成第 ${index + 1} 张 / 共 ${generateCount} 张...`);
        setResults((prev) => prev.map((item, idx) => (idx === index ? { ...item, status: 'generating', error: undefined } : item)));
        try {
          const item = await generateOne(index, brief, signal);
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
            next[index] = {
              ...(next[index] || { id: `error-${index}`, imageUrl: null, prompt: '' }),
              status: 'error',
              imageUrl: null,
              error: message,
            };
            return next;
          });
        }
      }

      assertCurrentGenerationTask(taskId, signal);
      if (generated.length > 0) {
        await saveGeneratedProject({
          type: 'MODEL',
          generated: generated.map((item) => item.imageUrl!).filter(Boolean),
          original: [getDataUrl(sourceModel), getDataUrl(targetScene)],
          prompt: generated[0].prompt,
          params: {
            subType: 'model_transfer',
            source: 'Cyzx4/components/ModelTransferTab',
            aspectRatio,
            resolution,
            model: selectedModel,
            outputFormat,
            generateCount,
            colorCorrectionMode,
            colorCorrectionBlend,
            extraNotes,
            agentBrief: brief,
          },
          thumbnail: generated[0].imageUrl || undefined,
        });
      }
      setStatusMessage('模特迁移完成');
    } catch (generateError) {
      if (!isAbortError(generateError)) {
        setError(getErrorMessage(generateError));
      }
    } finally {
      if (!isCurrentGenerationTask(taskId)) return;
      finishGenerationTask(taskId);
      setIsGenerating(false);
    }
  };

  const handleCancelGenerate = () => {
    cancelGenerationTask('已中止模特迁移生成');
    setIsGenerating(false);
    setStatusMessage('');
  };

  const handleDownload = (url: string, index: number) => {
    const link = document.createElement('a');
    const extension = getImageDownloadExtension(url, outputFormat);
    link.href = url;
    link.download = `model-transfer-${index + 1}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = () => {
    results.forEach((item, index) => {
      if (item.imageUrl) handleDownload(item.imageUrl, index);
    });
  };

  return (
    <div className="min-h-full bg-pastel-bg">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
        <section className="rounded-[1.75rem] border border-orange-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-[11px] font-black text-orange-600">
                <Sparkles className="h-3.5 w-3.5" />
                AI Agent Model Transfer
              </div>
              <h1 className="text-2xl font-black text-pastel-text">模特迁移 (Model Transfer)</h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-pastel-muted">
                上传我的模特和目标场景，Agent 会把源模特完整迁移进目标场景的姿态、镜头和光影里，同时锁定脸、发型、身材、服装和配饰。
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-pastel-border bg-pastel-bg/50 p-2 text-center text-[10px] font-bold text-pastel-muted">
              <div className="rounded-xl bg-white px-3 py-2">身份锁定</div>
              <div className="rounded-xl bg-white px-3 py-2">光影迁移</div>
              <div className="rounded-xl bg-white px-3 py-2">默认压红</div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(26rem,1.05fr)]">
          <div className="flex flex-col gap-4">
            <UploadCard
              title="我的模特图"
              desc="最高权重来源：保留人物身份、脸、发型、身材、服装、配饰与造型。"
              icon={<UserRound className="h-4 w-4" />}
              image={sourceModel}
              isActive={activeUploadKind === 'model'}
              pasteHint={activeUploadKind === 'model' ? 'Ctrl+V 粘贴到我的模特图' : '点击后可 Ctrl+V 粘贴'}
              onUpload={(files) => setSingleImage(files, setSourceModel)}
              onRemove={() => removeImage('model')}
              onActivate={() => activateUploadKind('model')}
            />
            <UploadCard
              title="目标场景图"
              desc="只提取场景、动作、镜头、构图、光影、阴影和色温，不复制其中模特的脸和衣服。"
              icon={<ImageIcon className="h-4 w-4" />}
              image={targetScene}
              isActive={activeUploadKind === 'scene'}
              pasteHint={activeUploadKind === 'scene' ? 'Ctrl+V 粘贴到目标场景图' : '点击后可 Ctrl+V 粘贴'}
              onUpload={(files) => setSingleImage(files, setTargetScene)}
              onRemove={() => removeImage('scene')}
              onActivate={() => activateUploadKind('scene')}
            />

            <section className="rounded-2xl border border-pastel-border bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-pastel-highlight" />
                <h3 className="text-sm font-bold text-pastel-text">生成参数</h3>
              </div>

              <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {MODEL_OPTIONS.map((model) => {
                  const active = selectedModel === model.id;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => setSelectedModel(model.id)}
                      className={`relative flex min-h-[5rem] flex-col items-center justify-center rounded-2xl border-2 bg-white p-3 text-center transition-all ${
                        active ? 'border-purple-400 bg-purple-50/50 text-purple-700 ring-1 ring-purple-100 shadow-sm' : 'border-pastel-border text-pastel-text hover:border-purple-200'
                      }`}
                    >
                      <span className="absolute left-3 top-2">{model.icon}</span>
                      <span className={`text-xs font-black ${active ? 'text-purple-700' : 'text-pastel-text'}`}>{model.label}</span>
                      <span className={`mt-1 text-[9px] font-bold ${active ? 'text-purple-600' : 'text-pastel-muted'}`}>{model.desc}</span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-pastel-muted">比例</label>
                  <select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value as AspectRatio)} className="min-h-[2.75rem] w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-orange-100">
                    {ASPECT_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.label} {item.desc}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-pastel-muted">清晰度</label>
                  <select value={resolution} onChange={(event) => setResolution(event.target.value as ImageResolution)} className="min-h-[2.75rem] w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-orange-100">
                    <option value={ImageResolution.RES_1K}>1K</option>
                    <option value={ImageResolution.RES_2K}>2K</option>
                    <option value={ImageResolution.RES_4K}>4K</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-pastel-muted">生成数量</label>
                  <select value={generateCount} onChange={(event) => setGenerateCount(Number(event.target.value))} className="min-h-[2.75rem] w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-orange-100">
                    {[1, 2, 3, 4].map((count) => <option key={count} value={count}>{count} 张</option>)}
                  </select>
                </div>
              </div>

              <textarea
                value={extraNotes}
                onChange={(event) => setExtraNotes(event.target.value)}
                placeholder="补充要求，例如：保留红裙和手提包、脸不要变、模拟墙面硬光阴影、肤色不要偏红..."
                className="mt-3 min-h-[5rem] w-full resize-y rounded-xl border border-pastel-border bg-pastel-bg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-orange-100"
              />
            </section>

            <section className="rounded-2xl border border-pastel-border bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Sun className="h-4 w-4 text-pastel-highlight" />
                <h3 className="text-sm font-bold text-pastel-text">色彩平衡</h3>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">默认修正偏红</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'off' as ColorCorrectionMode, label: '关闭', desc: '原图输出' },
                  { id: 'match' as ColorCorrectionMode, label: '匹配场景', desc: '参考目标图' },
                  { id: 'autoWhiteBalance' as ColorCorrectionMode, label: '自动白平衡', desc: 'Gray World' },
                  { id: 'redSuppress' as ColorCorrectionMode, label: '压红补青', desc: '推荐' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setColorCorrectionMode(item.id)}
                    className={`min-h-[3.25rem] rounded-xl border px-2 py-2 text-center transition-all ${
                      colorCorrectionMode === item.id ? 'border-blue-300 bg-blue-50 text-blue-700 ring-1 ring-blue-100' : 'border-pastel-border bg-pastel-bg/30 text-pastel-muted hover:border-blue-200'
                    }`}
                  >
                    <span className="block text-[11px] font-black">{item.label}</span>
                    <span className="mt-0.5 block text-[9px] opacity-70">{item.desc}</span>
                  </button>
                ))}
              </div>

              {colorCorrectionMode === 'match' && (
                <div className="mt-3 rounded-xl border border-dashed border-blue-200 bg-blue-50/30 p-3">
                  <button
                    type="button"
                    onClick={() => document.getElementById('model-transfer-color-ref')?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-blue-700 shadow-sm"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {colorReference ? '已上传独立色彩参考，点击替换' : '可选：上传独立色彩参考'}
                  </button>
                  <input
                    id="model-transfer-color-ref"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      setSingleImage(Array.from(event.target.files || []), setColorReference);
                      event.target.value = '';
                    }}
                  />
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

            <section className="rounded-2xl border border-pastel-border bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Download className="h-4 w-4 text-pastel-highlight" />
                <h3 className="text-sm font-bold text-pastel-text">输出格式</h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'jpg' as OutputImageFormat, label: 'JPG', desc: '电商常用' },
                  { id: 'png' as OutputImageFormat, label: 'PNG', desc: '高清保留' },
                ].map((item) => (
                  <button key={item.id} type="button" onClick={() => setOutputFormat(item.id)} className={`flex min-h-[3.25rem] flex-col items-center justify-center rounded-xl border transition-all ${outputFormat === item.id ? 'border-pastel-highlight bg-orange-50 text-pastel-highlight ring-1 ring-orange-100' : 'border-pastel-border bg-pastel-bg/30 text-pastel-muted hover:border-orange-200'}`}>
                    <span className="text-[11px] font-bold">{item.label}</span>
                    <span className="text-[9px] opacity-60">{item.desc}</span>
                  </button>
                ))}
              </div>
            </section>

            <button type="button" onClick={handleGenerate} disabled={!canGenerate} className={`flex min-h-[3.75rem] w-full items-center justify-center gap-3 rounded-2xl py-4 font-bold text-white shadow-lg transition-all ${canGenerate ? 'bg-gradient-to-r from-orange-500 to-pink-500 hover:scale-[1.01] hover:shadow-orange-500/30' : 'bg-gray-300'}`}>
              {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
              {isGenerating ? 'Agent 正在迁移...' : `一键生成模特迁移 (${outputCountLabel})`}
            </button>
            {isGenerating && (
              <button type="button" onClick={handleCancelGenerate} className="flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-gray-950">
                <X className="h-4 w-4" />
                中止生成
              </button>
            )}
            {cancelMessage && !isGenerating && <p className="text-center text-xs font-bold text-orange-600">{cancelMessage}</p>}
          </div>

          <div className="flex flex-col gap-4">
            {agentBrief && (
              <section className="rounded-2xl border border-green-100 bg-green-50/70 p-4 text-xs leading-relaxed text-green-900">
                <div className="mb-2 flex items-center gap-2 font-black">
                  <CheckCircle2 className="h-4 w-4" />
                  迁移导演 Agent Brief
                </div>
                <p className="line-clamp-5 whitespace-pre-line">{agentBrief}</p>
              </section>
            )}

            <section className="relative flex min-h-[42rem] flex-1 flex-col rounded-2xl border border-pastel-border bg-white p-5 shadow-sm">
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
                {isGenerating && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center space-y-5 bg-white/80 backdrop-blur-sm">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full border bg-white text-orange-500 shadow-xl">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                    <div className="text-center">
                      <h4 className="font-bold text-pastel-text">模特迁移生成中</h4>
                      <p className="mt-1 text-xs text-pastel-muted">{statusMessage || '正在锁定身份、迁移姿态与匹配光影...'}</p>
                    </div>
                  </div>
                )}

                {results.length > 0 ? (
                  <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] content-start gap-5 overflow-y-auto p-5">
                    {results.map((item, index) => (
                      <div key={item.id} className="group relative overflow-hidden rounded-2xl border border-white bg-white shadow-xl">
                        <div className={`relative flex ${getResultAspectClass(aspectRatio)} min-h-[18rem] items-center justify-center bg-white`}>
                          {item.status === 'generating' && !item.imageUrl && <div className="flex flex-col items-center gap-2 text-orange-500"><Loader2 className="h-7 w-7 animate-spin" /><span className="text-xs font-bold">生成中...</span></div>}
                          {item.status === 'error' && <div className="p-5 text-center text-xs font-bold text-red-500">{item.error || '生成失败'}</div>}
                          {item.imageUrl && <img src={item.imageUrl} alt={`模特迁移 ${index + 1}`} className="h-full w-full object-contain" />}
                          {item.status === 'pending' && <div className="text-xs font-bold text-pastel-muted">等待生成</div>}
                        </div>
                        <div className="border-t border-pastel-border bg-white px-3 py-2">
                          <div className="truncate text-[10px] font-bold text-pastel-text">模特迁移 #{index + 1}</div>
                        </div>
                        {item.imageUrl && item.status !== 'generating' && (
                          <div className="absolute inset-0 flex items-center justify-center gap-3 bg-black/50 opacity-0 backdrop-blur-[2px] transition-opacity group-hover:opacity-100">
                            <button type="button" onClick={() => setSelectedPreview(item.imageUrl)} className="rounded-full bg-white/20 p-3 text-white transition-transform hover:scale-110 hover:bg-white/40"><Maximize className="h-5 w-5" /></button>
                            <button type="button" onClick={handleGenerate} disabled={isGenerating} className="rounded-full bg-white/20 p-3 text-white transition-transform hover:scale-110 hover:bg-white/40 disabled:opacity-50"><RefreshCw className="h-5 w-5" /></button>
                            <button type="button" onClick={() => handleDownload(item.imageUrl!, index)} className="rounded-full bg-white/20 p-3 text-white transition-transform hover:scale-110 hover:bg-white/40"><Download className="h-5 w-5" /></button>
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
                    <p className="max-w-[22rem] text-sm text-pastel-muted">
                      上传“我的模特图”和“目标场景图”后，Agent 会生成保留源模特身份和服装的场景迁移结果。
                    </p>
                    <div className="flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[10px] font-bold text-blue-700">
                      <Sun className="h-3 w-3" />
                      默认启用压红补青，降低 Gemini 偏红问题
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>

      {selectedPreview && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4" onClick={() => setSelectedPreview(null)}>
          <div className="relative max-h-[90vh] max-w-5xl overflow-hidden rounded-2xl bg-white" onClick={(event) => event.stopPropagation()}>
            <img src={selectedPreview} alt="模特迁移预览" className="max-h-[85vh] w-auto object-contain" />
            <button type="button" onClick={() => setSelectedPreview(null)} className="absolute right-4 top-4 rounded-full bg-black/40 p-2 text-white">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelTransferTab;
