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

type UploadKind = 'model' | 'scene';
type OutfitMode = 'auto' | 'source' | 'target';
type GenerationStatus = 'pending' | 'submitting' | 'polling' | 'processing' | 'done' | 'error' | 'cancelled';

type UploadedImage = {
  id: string;
  preview: string;
  base64: string;
  mime: string;
  name: string;
};

type AgentAnalysis = {
  identityBrief: string;
  transferSourceOutfit: boolean;
  outfitReason: string;
};

type PreparedScene = {
  scene: UploadedImage;
  poseAnchor: { base64: string; mimeType: string };
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

const MODEL_SLOTS = ['正面', '侧面', '微侧'] as const;
const MAX_MODEL_IMAGES = 3;
const MAX_SCENE_IMAGES = 10;

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
  identityBrief: 'Lock the exact same source person across every output: facial structure and feature spacing, eyes, nose, lips, eyebrows, hairline, hairstyle, complexion, age impression, recognizable likeness, body frame, shoulder width, torso proportions and overall silhouette.',
  transferSourceOutfit: detectsSourceOutfitRequest(notes),
  outfitReason: detectsSourceOutfitRequest(notes) ? '用户补充要求提到了迁移源模特服装。' : '补充要求未明确要求迁移源模特服装。',
});

const buildAgentPrompt = (sourceCount: number, notes: string) => `
You are a fashion identity continuity director. Images 1-${sourceCount} are different views of the SAME source model.
Build one unified identity profile from all views. Lock facial geometry, feature spacing, hairline, hairstyle, complexion, age impression, recognizable likeness, body frame and proportions.
Also decide whether the user explicitly wants the source model's clothes/outfit/shoes/bag/accessories transferred.

Return valid JSON only:
{"identityBrief":"concise English identity lock","transferSourceOutfit":false,"outfitReason":"short Chinese reason"}

User notes: ${notes || 'No extra notes.'}
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
  extraNotes: string;
  sceneNumber: number;
}) => {
  const anchorEnd = options.sourceCount;
  const contextStart = anchorEnd + 1;
  const contextEnd = anchorEnd + options.sourceCount;
  const sceneIndex = contextEnd + 1;
  const poseIndex = sceneIndex + 1;
  const outfitRules = options.transferSourceOutfit
    ? `
# SOURCE OUTFIT TRANSFER — REQUIRED
- Transfer the complete outfit visible across source Images ${contextStart}-${contextEnd}: garment structure, silhouette, neckline, sleeves, waist, hem, fabric, color, pattern, seams and layering.
- Also transfer source shoes, bag, jewelry and accessories when clearly visible and consistent across the references.
- Adapt the source outfit naturally to the pose and occlusions in Image ${sceneIndex}; preserve realistic folds, contact, perspective and scene lighting.
- Do not retain, blend with, or borrow clothing from the target-scene person.`
    : `
# TARGET OUTFIT PRESERVATION — REQUIRED
- Keep Image ${sceneIndex}'s clothing, garment construction, colors, fabric, shoes, bag, jewelry and accessories unchanged.
- Source Images ${contextStart}-${contextEnd} provide identity/body context only. Do not copy their clothing, styling or accessories.`;

  return `
Create ONE photorealistic commercial fashion image for target scene #${options.sceneNumber}.

# IMAGE ROUTING
- Images 1-${anchorEnd} are head/identity anchors of the SAME source model from multiple views. Together they have absolute priority for the output person's face, head identity, hairline and hairstyle.
- Images ${contextStart}-${contextEnd} are full source-model context views. Use all of them to preserve the same person's body frame, shoulder width, proportions, complexion and overall recognizable appearance.
- Image ${sceneIndex} is the target scene base. Preserve its pose, gesture, body placement, camera, lens perspective, crop, background, architecture, props, light direction, shadow geometry, color temperature and atmosphere.
- Image ${poseIndex} is target pose lineart only. Copy head angle, shoulder slope, torso lean, arms, hands, legs, crop, scale and placement. It has no valid face, identity, clothing, color or texture.

# UNIFIED SOURCE IDENTITY — HIGHEST PRIORITY
${options.analysis.identityBrief}
- The final person must unmistakably be the exact source model, not the target-scene person and not a blended identity.
- Replace the entire target person's visible identity and appearance: face, facial structure, head, hair, skin identity and body characteristics, while fitting them naturally into the target pose.
- Reconcile all source views as observations of one person. Never create averaged, mixed, duplicated or inconsistent faces.
${outfitRules}

# SCENE AND LIGHTING LOCK
- Preserve Image ${sceneIndex}'s composition and environment pixel-faithfully wherever the person is not being replaced.
- Re-light the transferred model and outfit to Image ${sceneIndex}'s exact key-light direction, softness, face shadow, cast shadows, contact shadows, contrast and warm/cool balance.
- Do not copy the source pose, source background or source camera angle.

# USER NOTES
${options.extraNotes || 'No extra notes.'}

# REJECT
target identity retained, blended face, identity drift, different person, inconsistent face, source pose copied, target pose changed, body proportions drift, background changed, camera changed, lighting mismatch, two people, collage, red cast, plastic skin, waxy face, CGI, bad anatomy, distorted hands, text, watermark, logo.
`.trim();
};

const getResultAspectClass = (ratio: AspectRatio) => {
  if (ratio === AspectRatio.SQUARE) return 'aspect-square';
  if (ratio === AspectRatio.PORTRAIT_2_3) return 'aspect-[2/3]';
  if (ratio === AspectRatio.PORTRAIT_4_5) return 'aspect-[4/5]';
  if (ratio === AspectRatio.PORTRAIT_9_16) return 'aspect-[9/16]';
  if (ratio === AspectRatio.LANDSCAPE_16_9) return 'aspect-video';
  if (ratio === AspectRatio.LANDSCAPE_21_9) return 'aspect-[21/9]';
  return 'aspect-[3/4]';
};

const getResultMinHeightClass = (ratio: AspectRatio) => {
  if (ratio === AspectRatio.LANDSCAPE_16_9 || ratio === AspectRatio.LANDSCAPE_21_9) return 'min-h-0';
  return 'min-h-64';
};

const ModelTransferTab: React.FC<{ isActive?: boolean }> = ({ isActive = true }) => {
  const [sourceModels, setSourceModels] = useState<UploadedImage[]>([]);
  const [targetScenes, setTargetScenes] = useState<UploadedImage[]>([]);
  const [activeUploadKind, setActiveUploadKind] = useState<UploadKind>('model');
  const [selectedModel, setSelectedModel] = useState(MODEL_OPTIONS[0].id);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.PORTRAIT_3_4);
  const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.RES_2K);
  const [outputFormat, setOutputFormat] = useState<OutputImageFormat>('png');
  const [colorCorrectionMode, setColorCorrectionMode] = useState<ColorCorrectionMode>('match');
  const [colorCorrectionBlend, setColorCorrectionBlend] = useState(0.55);
  const [outfitMode, setOutfitMode] = useState<OutfitMode>('auto');
  const [extraNotes, setExtraNotes] = useState('');
  const [agentAnalysis, setAgentAnalysis] = useState<AgentAnalysis | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const activeUploadKindRef = useRef<UploadKind>('model');
  const modelInputRef = useRef<HTMLInputElement>(null);
  const sceneInputRef = useRef<HTMLInputElement>(null);
  const {
    cancelMessage,
    startGenerationTask,
    cancelGenerationTask,
    isCurrentGenerationTask,
    assertCurrentGenerationTask,
    finishGenerationTask,
  } = useCancelableGeneration();

  const canGenerate = sourceModels.length > 0 && targetScenes.length > 0 && !isGenerating;
  const completedCount = results.filter((item) => item.status === 'done' || item.status === 'error' || item.status === 'cancelled').length;

  const processFiles = useCallback(async (files: File[], kind: UploadKind) => {
    const valid = files.filter((file) => file.type.startsWith('image/'));
    const currentCount = kind === 'model' ? sourceModels.length : targetScenes.length;
    const max = kind === 'model' ? MAX_MODEL_IMAGES : MAX_SCENE_IMAGES;
    const accepted = valid.slice(0, Math.max(0, max - currentCount));
    if (!accepted.length) {
      if (valid.length) setError(`${kind === 'model' ? '模特参考图' : '目标场景图'}最多上传 ${max} 张。`);
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
    if (kind === 'model') setSourceModels((prev) => [...prev, ...uploaded].slice(0, MAX_MODEL_IMAGES));
    else setTargetScenes((prev) => [...prev, ...uploaded].slice(0, MAX_SCENE_IMAGES));
    if (valid.length > accepted.length) setError(`已达到上限，仅添加前 ${accepted.length} 张图片。`);
    else setError('');
  }, [sourceModels.length, targetScenes.length]);

  const activateUploadKind = useCallback((kind: UploadKind) => {
    activeUploadKindRef.current = kind;
    setActiveUploadKind(kind);
  }, []);

  const handlePastedImages = useCallback((files: File[]) => {
    void processFiles(files, activeUploadKindRef.current);
  }, [processFiles]);
  useImagePaste(handlePastedImages, isActive && !isGenerating);

  const removeUploadedImage = (kind: UploadKind, id: string) => {
    const setter = kind === 'model' ? setSourceModels : setTargetScenes;
    setter((prev) => {
      const removed = prev.find((item) => item.id === id);
      if (removed?.preview.startsWith('blob:')) URL.revokeObjectURL(removed.preview);
      return prev.filter((item) => item.id !== id);
    });
  };

  const analyzeIdentity = async (sources: UploadedImage[], signal: AbortSignal) => {
    setStatusMessage('Agent 正在综合多角度参考，建立统一身份档案...');
    try {
      const text = await generateText(sources.map(toApiImage), buildAgentPrompt(sources.length, extraNotes));
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      return parseAgentAnalysis(text, extraNotes);
    } catch (analysisError) {
      if (isAbortError(analysisError)) throw analysisError;
      console.warn('Model transfer identity analysis failed; using fallback.', analysisError);
      return fallbackAnalysis(extraNotes);
    }
  };

  const prepareIdentityAnchors = (sources: UploadedImage[]) => Promise.all(
    sources.map(async (source) => dataUrlToApiImage(await createModelHeadIdentityCrop(getDataUrl(source))))
  );

  const prepareScenes = (scenes: UploadedImage[]) => Promise.all(
    scenes.map(async (scene): Promise<PreparedScene> => ({
      scene,
      poseAnchor: dataUrlToApiImage(await extractEdges(getDataUrl(scene))),
    }))
  );

  const updateResult = (sceneId: string, patch: Partial<ResultItem>) => {
    setResults((prev) => prev.map((item) => item.sceneId === sceneId ? { ...item, ...patch } : item));
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
    const transferSourceOutfit = outfitMode === 'source' || (outfitMode === 'auto' && analysis.transferSourceOutfit);
    const prompt = buildTransferPrompt({
      sourceCount: sources.length,
      analysis,
      transferSourceOutfit,
      extraNotes,
      sceneNumber: sceneIndex + 1,
    });
    updateResult(prepared.scene.id, { status: 'submitting', error: undefined, prompt });
    const [rawImage] = await generateImageToImage(
      [...identityAnchors, ...sources.map(toApiImage), toApiImage(prepared.scene), prepared.poseAnchor],
      prompt,
      {
        aspectRatio,
        resolution,
        modelId: selectedModel,
        workflowHint: 'model-transfer',
        hasModelRef: true,
        signal,
        onStatus: (status) => updateResult(prepared.scene.id, { status }),
      }
    );
    if (!rawImage) throw new Error('模型未返回图片。');
    updateResult(prepared.scene.id, { status: 'processing' });
    const correctedImage = await applyColorCorrection(rawImage, {
      mode: colorCorrectionMode,
      reference: colorCorrectionMode === 'match' ? getDataUrl(prepared.scene) : undefined,
      blend: colorCorrectionBlend,
    });
    const formattedImage = await convertImageDataUrlFormat(correctedImage, outputFormat);
    return {
      id: `result-${prepared.scene.id}`,
      sceneId: prepared.scene.id,
      sceneName: prepared.scene.name,
      imageUrl: formattedImage,
      status: 'done',
      prompt,
    };
  };

  const saveBatch = async (sources: UploadedImage[], scenes: UploadedImage[], analysis: AgentAnalysis, batchResults: ResultItem[]) => {
    const successful = batchResults.filter((item) => item.status === 'done' && item.imageUrl);
    if (!successful.length) return;
    const effectiveOutfitTransfer = outfitMode === 'source' || (outfitMode === 'auto' && analysis.transferSourceOutfit);
    await saveGeneratedProject({
      type: 'MODEL',
      generated: successful.map((item) => item.imageUrl!),
      original: [...sources, ...scenes].map(getDataUrl),
      prompt: successful[0].prompt,
      params: {
        subType: 'model_transfer_batch',
        source: 'Cyzx4/components/ModelTransferTab',
        aspectRatio,
        resolution,
        model: selectedModel,
        outputFormat,
        sourceModelCount: sources.length,
        targetSceneCount: scenes.length,
        outfitMode,
        transferSourceOutfit: effectiveOutfitTransfer,
        outfitReason: analysis.outfitReason,
        colorCorrectionMode,
        colorCorrectionBlend,
        extraNotes,
        identityBrief: analysis.identityBrief,
        sceneResultMap: batchResults.map((item) => ({ sceneId: item.sceneId, sceneName: item.sceneName, status: item.status, error: item.error })),
      },
      thumbnail: successful[0].imageUrl || undefined,
    });
  };

  const handleGenerate = async () => {
    if (!sourceModels.length || !targetScenes.length) {
      setError('请至少上传 1 张模特参考图和 1 张目标场景图。');
      return;
    }
    const sources = [...sourceModels];
    const scenes = [...targetScenes];
    const { taskId, signal } = startGenerationTask();
    setError('');
    setAgentAnalysis(null);
    setIsGenerating(true);
    setResults(scenes.map((scene) => ({
      id: `pending-${scene.id}`,
      sceneId: scene.id,
      sceneName: scene.name,
      imageUrl: null,
      status: 'pending',
      prompt: '',
    })));

    try {
      const analysis = await analyzeIdentity(sources, signal);
      assertCurrentGenerationTask(taskId, signal);
      setAgentAnalysis(analysis);
      setStatusMessage('正在并行提取全部场景姿态与多角度身份锚点...');
      const [identityAnchors, preparedScenes] = await Promise.all([
        prepareIdentityAnchors(sources),
        prepareScenes(scenes),
      ]);
      assertCurrentGenerationTask(taskId, signal);
      setStatusMessage(`已同时提交 ${scenes.length} 个迁移任务，正在独立轮询结果...`);

      const settled = await Promise.allSettled(preparedScenes.map((prepared, sceneIndex) =>
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
      ));
      assertCurrentGenerationTask(taskId, signal);
      const batchResults = settled
        .filter((entry): entry is PromiseFulfilledResult<ResultItem> => entry.status === 'fulfilled')
        .map((entry) => entry.value);
      await saveBatch(sources, scenes, analysis, batchResults);
      setStatusMessage(`批量迁移完成：${batchResults.filter((item) => item.status === 'done').length}/${scenes.length} 张成功`);
    } catch (generateError) {
      if (!isAbortError(generateError)) setError(getErrorMessage(generateError));
    } finally {
      if (!isCurrentGenerationTask(taskId)) return;
      finishGenerationTask(taskId);
      setIsGenerating(false);
    }
  };

  const handleRegenerateOne = async (sceneId: string) => {
    const scene = targetScenes.find((item) => item.id === sceneId);
    if (!scene || !sourceModels.length || isGenerating) return;
    const sources = [...sourceModels];
    const analysis = agentAnalysis || fallbackAnalysis(extraNotes);
    const { taskId, signal } = startGenerationTask();
    setIsGenerating(true);
    setError('');
    updateResult(scene.id, { status: 'submitting', error: undefined });
    setStatusMessage(`场景 ${targetScenes.indexOf(scene) + 1} 正在准备重新生成...`);
    try {
      const [identityAnchors, [prepared]] = await Promise.all([
        prepareIdentityAnchors(sources),
        prepareScenes([scene]),
      ]);
      const item = await generatePreparedScene({ prepared, sceneIndex: targetScenes.indexOf(scene), sources, identityAnchors, analysis, signal });
      assertCurrentGenerationTask(taskId, signal);
      updateResult(scene.id, item);
      await saveBatch(sources, [scene], analysis, [item]);
      setStatusMessage(`场景 ${targetScenes.indexOf(scene) + 1} 已重新生成`);
    } catch (retryError) {
      if (!isAbortError(retryError)) updateResult(scene.id, { status: 'error', error: getErrorMessage(retryError) });
    } finally {
      if (!isCurrentGenerationTask(taskId)) return;
      finishGenerationTask(taskId);
      setIsGenerating(false);
    }
  };

  const handleCancelGenerate = () => {
    cancelGenerationTask('已中止模特迁移生成');
    setResults((prev) => prev.map((item) =>
      ['pending', 'submitting', 'polling', 'processing'].includes(item.status)
        ? { ...item, status: 'cancelled', error: '已中止' }
        : item
    ));
    setIsGenerating(false);
    setStatusMessage('');
  };

  const handleDownload = (url: string, index: number) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `model-transfer-${index + 1}.${getImageDownloadExtension(url, outputFormat)}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = () => results.forEach((item, index) => {
    if (item.imageUrl) handleDownload(item.imageUrl, index);
  });

  const effectiveOutfitLabel = useMemo(() => {
    if (outfitMode === 'source') return '强制迁移源服装';
    if (outfitMode === 'target') return '强制保留场景服装';
    if (!agentAnalysis) return '等待 AI 判断';
    return agentAnalysis.transferSourceOutfit ? 'AI：迁移源服装' : 'AI：保留场景服装';
  }, [agentAnalysis, outfitMode]);

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

  const renderUploadArea = (kind: UploadKind) => {
    const isModel = kind === 'model';
    const images = isModel ? sourceModels : targetScenes;
    const max = isModel ? MAX_MODEL_IMAGES : MAX_SCENE_IMAGES;
    const inputRef = isModel ? modelInputRef : sceneInputRef;
    return (
      <section
        onMouseEnter={() => activateUploadKind(kind)}
        onMouseMove={() => activateUploadKind(kind)}
        onPointerEnter={() => activateUploadKind(kind)}
        onPointerMove={() => activateUploadKind(kind)}
        onFocusCapture={() => activateUploadKind(kind)}
        className={`rounded-2xl border bg-white p-4 shadow-sm sm:p-5 ${activeUploadKind === kind ? 'border-orange-300 ring-2 ring-orange-100' : 'border-pastel-border'}`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <div className="mt-0.5 text-pastel-highlight">{isModel ? <UserRound className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}</div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-pastel-text">{isModel ? '我的模特参考图' : '目标场景图'}</h3>
              <p className="mt-1 text-xs leading-relaxed text-pastel-muted">
                {isModel ? '最多 3 张：正面、侧面、微侧，共同锁定同一人物长相与身材。' : '最多 10 张，每张场景对应生成 1 张迁移结果。'}
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-black text-orange-600">{images.length}/{max}</span>
        </div>
        <div className={`grid grid-cols-1 gap-3 ${isModel ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
          {images.map((image, index) => (
            <div key={image.id} className="relative overflow-hidden rounded-xl border border-pastel-border bg-pastel-bg/30">
              <div className="aspect-[4/3] overflow-hidden bg-white"><img src={image.preview} alt={isModel ? `模特${MODEL_SLOTS[index]}` : `目标场景${index + 1}`} className="h-full w-full object-contain" /></div>
              <div className="flex min-h-11 items-center justify-between gap-2 border-t border-pastel-border px-3">
                <span className="truncate text-xs font-bold text-pastel-text">{isModel ? MODEL_SLOTS[index] : `场景 ${index + 1}`}</span>
                <button type="button" onClick={() => removeUploadedImage(kind, image.id)} disabled={isGenerating} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-pastel-muted hover:bg-red-50 hover:text-red-500 disabled:opacity-40" aria-label="删除图片"><X className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
          {images.length < max ? (
            <button
              type="button"
              onClick={() => { activateUploadKind(kind); inputRef.current?.click(); }}
              onDragOver={(event) => { event.preventDefault(); activateUploadKind(kind); }}
              onDrop={(event) => { event.preventDefault(); activateUploadKind(kind); void processFiles(Array.from(event.dataTransfer.files), kind); }}
              className="flex min-h-36 flex-col items-center justify-center rounded-xl border-2 border-dashed border-pastel-border bg-pastel-bg/30 p-4 text-center transition-colors hover:border-orange-300 hover:bg-orange-50/40 sm:min-h-44"
            >
              <Upload className="mb-2 h-7 w-7 text-pastel-muted" />
              <span className="text-sm font-bold text-pastel-text">点击或拖入图片</span>
              <span className="mt-1 text-xs text-pastel-muted">选中此区域后也可 Ctrl+V</span>
            </button>
          ) : null}
        </div>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => { void processFiles(Array.from(event.target.files || []), kind); event.target.value = ''; }} />
      </section>
    );
  };

  return (
    <div className="no-scrollbar h-full min-h-0 overflow-x-hidden overflow-y-auto bg-pastel-bg">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-3 py-4 sm:px-4 sm:py-6 md:px-6 lg:px-8">
        <section className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm sm:rounded-[1.75rem] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-xs font-black text-orange-600"><Sparkles className="h-4 w-4" />AI Agent Model Transfer</div>
              <h1 className="text-xl font-black text-pastel-text sm:text-2xl">模特迁移 (Model Transfer)</h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-pastel-muted">用最多三张多角度参考锁定同一模特的完整样貌，同时把人物并发迁移到最多十张目标场景；姿势、镜头、背景与光影保持场景一致。</p>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-pastel-border bg-pastel-bg/50 p-2 text-center text-xs font-bold text-pastel-muted"><div className="rounded-xl bg-white px-2 py-2">多角度身份锁定</div><div className="rounded-xl bg-white px-2 py-2">10 图并发轮询</div><div className="rounded-xl bg-white px-2 py-2">服装智能路由</div></div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(26rem,1.05fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            {renderUploadArea('model')}
            {renderUploadArea('scene')}

            <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center gap-2"><Wand2 className="h-5 w-5 text-pastel-highlight" /><h3 className="text-sm font-bold text-pastel-text">生成参数</h3></div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {MODEL_OPTIONS.map((model) => <button key={model.id} type="button" onClick={() => setSelectedModel(model.id)} disabled={isGenerating} className={`relative flex min-h-20 flex-col items-center justify-center rounded-2xl border-2 p-3 transition-all ${selectedModel === model.id ? 'border-purple-400 bg-purple-50 text-purple-700' : 'border-pastel-border bg-white text-pastel-text hover:border-purple-200'}`}><Zap className="absolute left-3 top-3 h-4 w-4 text-orange-500" /><span className="text-xs font-black">{model.label}</span><span className="mt-1 text-xs opacity-70">{model.desc}</span></button>)}
              </div>
              <label className="mt-4 block text-xs font-bold text-pastel-muted">清晰度<select value={resolution} onChange={(event) => setResolution(event.target.value as ImageResolution)} disabled={isGenerating} className="mt-1 min-h-11 w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-sm font-bold text-pastel-text outline-none focus:ring-2 focus:ring-orange-100"><option value={ImageResolution.RES_1K}>1K</option><option value={ImageResolution.RES_2K}>2K</option><option value={ImageResolution.RES_4K}>4K</option></select></label>
              <div className="mt-4"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-bold text-pastel-muted">服装策略</span><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{effectiveOutfitLabel}</span></div><div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{OUTFIT_OPTIONS.map((item) => <button key={item.id} type="button" onClick={() => setOutfitMode(item.id)} disabled={isGenerating} className={`min-h-16 rounded-xl border px-3 py-2 text-left ${outfitMode === item.id ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-pastel-border bg-white text-pastel-text'}`}><span className="block text-xs font-black">{item.label}</span><span className="mt-1 block text-xs opacity-70">{item.desc}</span></button>)}</div></div>
              <textarea value={extraNotes} onChange={(event) => setExtraNotes(event.target.value)} disabled={isGenerating} placeholder="补充要求，例如：把我的模特图中穿的衣服也同步换到所有目标场景里……" className="mt-4 min-h-24 w-full resize-y rounded-xl border border-pastel-border bg-pastel-bg px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-100" />
            </section>

            <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center gap-2">
                <Maximize className="h-5 w-5 text-pastel-highlight" />
                <h3 className="text-sm font-black text-pastel-text">画幅比例</h3>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {ASPECT_OPTIONS.map((item) => {
                  const active = aspectRatio === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setAspectRatio(item.id)}
                      disabled={isGenerating}
                      aria-pressed={active}
                      className={`flex min-h-[3.25rem] flex-col items-center justify-center rounded-xl border px-2 py-2 text-center transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                        active
                          ? 'border-orange-500 bg-orange-50/70 text-orange-500 ring-1 ring-orange-100'
                          : 'border-pastel-border bg-white text-pastel-muted hover:border-orange-200'
                      }`}
                    >
                      <span className="text-xs font-black">{item.label}</span>
                      <span className={`mt-0.5 text-[10px] ${active ? 'text-orange-400' : 'text-gray-300'}`}>{item.desc}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-3 flex items-center gap-2"><Sun className="h-5 w-5 text-pastel-highlight" /><h3 className="text-sm font-bold text-pastel-text">色彩修正</h3></div>
              <div className="grid grid-cols-2 gap-2">{(['off', 'match', 'autoWhiteBalance', 'redSuppress'] as ColorCorrectionMode[]).map((mode) => <button key={mode} type="button" onClick={() => setColorCorrectionMode(mode)} disabled={isGenerating} className={`min-h-11 rounded-xl border px-2 text-xs font-bold ${colorCorrectionMode === mode ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-pastel-border text-pastel-muted'}`}>{({ off: '关闭修正', match: '匹配各场景', autoWhiteBalance: '自动白平衡', redSuppress: '压红补青' } as Record<ColorCorrectionMode, string>)[mode]}</button>)}</div>
              {colorCorrectionMode !== 'off' ? <label className="mt-3 block text-xs font-bold text-pastel-muted">修正强度 {Math.round(colorCorrectionBlend * 100)}%<input type="range" min="0.3" max="1" step="0.05" value={colorCorrectionBlend} onChange={(event) => setColorCorrectionBlend(Number(event.target.value))} disabled={isGenerating} className="mt-2 w-full accent-blue-500" /></label> : null}
            </section>

            <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Download className="h-5 w-5 text-pastel-highlight" />
                <h3 className="text-sm font-black text-pastel-text">输出格式</h3>
                <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-500">下载与历史保存格式</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {([
                  { id: 'jpg' as OutputImageFormat, label: 'JPG', desc: '兼容' },
                  { id: 'png' as OutputImageFormat, label: 'PNG', desc: '默认 · 高清' },
                ]).map((format) => {
                  const active = outputFormat === format.id;
                  return (
                    <button
                      key={format.id}
                      type="button"
                      onClick={() => setOutputFormat(format.id)}
                      disabled={isGenerating}
                      aria-pressed={active}
                      className={`flex min-h-[3.25rem] flex-col items-center justify-center rounded-xl border px-3 py-2 text-center transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                        active
                          ? 'border-orange-500 bg-orange-50/70 text-orange-500 ring-1 ring-orange-100'
                          : 'border-pastel-border bg-white text-pastel-muted hover:border-orange-200'
                      }`}
                    >
                      <span className="text-xs font-black">{format.label}</span>
                      <span className={`mt-0.5 text-[10px] ${active ? 'text-orange-400' : 'text-gray-300'}`}>{format.desc}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <button type="button" onClick={handleGenerate} disabled={!canGenerate} className={`flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-lg transition-all ${canGenerate ? 'bg-gradient-to-r from-orange-500 to-pink-500 hover:scale-[1.01]' : 'bg-gray-300'}`}>{isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}{isGenerating ? `并发迁移中 ${completedCount}/${targetScenes.length}` : `同时迁移 ${targetScenes.length || 0} 个场景`}</button>
            {isGenerating ? <button type="button" onClick={handleCancelGenerate} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 px-4 py-3 text-sm font-bold text-white"><X className="h-4 w-4" />中止全部任务</button> : null}
            {cancelMessage && !isGenerating ? <p className="text-center text-sm font-bold text-orange-600">{cancelMessage}</p> : null}
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {agentAnalysis ? <section className="rounded-2xl border border-green-100 bg-green-50/70 p-4 text-sm leading-relaxed text-green-900"><div className="mb-2 flex items-center gap-2 font-black"><CheckCircle2 className="h-4 w-4" />统一身份档案 · {effectiveOutfitLabel}</div><p className="line-clamp-4">{agentAnalysis.identityBrief}</p>{agentAnalysis.outfitReason ? <p className="mt-2 text-xs opacity-75">{agentAnalysis.outfitReason}</p> : null}</section> : null}
            <section className="flex min-h-[36rem] flex-1 flex-col rounded-2xl border border-pastel-border bg-white p-4 shadow-sm sm:p-5 xl:min-h-[42rem]">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-orange-500" /><h3 className="text-lg font-bold text-pastel-text">生成结果</h3>{results.length ? <span className="text-xs font-bold text-pastel-muted">{completedCount}/{results.length}</span> : null}</div><div className="flex flex-wrap items-center gap-2">{error ? <div className="flex min-h-11 max-w-full items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 text-xs text-red-600"><AlertCircle className="h-4 w-4 shrink-0" /><span className="break-words">{error}</span></div> : null}{results.some((item) => item.imageUrl) && !isGenerating ? <button type="button" onClick={handleDownloadAll} className="flex min-h-11 items-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-pink-500 px-4 text-xs font-black text-white"><Download className="h-4 w-4" />全部下载</button> : null}</div></div>
              <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border-2 border-dashed border-pastel-border bg-pastel-bg/50">
                {results.length ? <div className="no-scrollbar grid w-full grid-cols-1 content-start gap-4 overflow-y-auto p-3 sm:grid-cols-2 sm:p-5">{results.map((item, index) => <article key={item.sceneId} className="group relative overflow-hidden rounded-2xl border border-pastel-border bg-white shadow-md"><div className={`relative flex ${getResultAspectClass(aspectRatio)} ${getResultMinHeightClass(aspectRatio)} items-center justify-center overflow-hidden bg-white`}>{item.imageUrl ? <img src={item.imageUrl} alt={`模特迁移 ${index + 1}`} className={`h-full w-full object-contain transition-all duration-300 ${isWorkingStatus(item.status) ? 'scale-[1.02] blur-[2px] brightness-75' : ''}`} /> : item.status === 'error' || item.status === 'cancelled' ? <div className="p-5 text-center text-sm font-bold text-red-500">{item.error || statusLabel(item.status)}</div> : <div className="flex flex-col items-center gap-3 p-5 text-center text-orange-500"><Loader2 className={`h-7 w-7 ${item.status !== 'pending' ? 'animate-spin' : ''}`} /><span className="text-sm font-bold">{statusLabel(item.status)}</span></div>}{item.imageUrl && isWorkingStatus(item.status) ? <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/35 text-white backdrop-blur-[1px]"><div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/40 bg-black/25 shadow-lg"><RefreshCw className="h-7 w-7 animate-spin" /></div><span className="rounded-full bg-black/35 px-4 py-2 text-sm font-black">重新生成中 · {statusLabel(item.status)}</span></div> : null}</div><div className="flex min-h-14 items-center justify-between gap-2 border-t border-pastel-border px-3"><div className="min-w-0"><div className="truncate text-xs font-black text-pastel-text">场景 {index + 1}</div><div className={`truncate text-xs ${isWorkingStatus(item.status) ? 'font-bold text-orange-500' : 'text-pastel-muted'}`}>{item.imageUrl && isWorkingStatus(item.status) ? `重新生成中 · ${statusLabel(item.status)}` : statusLabel(item.status)}</div></div><div className="flex shrink-0 gap-1">{item.imageUrl ? <button type="button" onClick={() => setSelectedPreview(item.imageUrl)} disabled={isWorkingStatus(item.status)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-pastel-muted hover:bg-pastel-bg disabled:opacity-40" aria-label="预览"><Maximize className="h-4 w-4" /></button> : null}<button type="button" onClick={() => void handleRegenerateOne(item.sceneId)} disabled={isGenerating} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-pastel-muted hover:bg-orange-50 hover:text-orange-500 disabled:opacity-40" aria-label="单张重试"><RefreshCw className={`h-4 w-4 ${item.imageUrl && isWorkingStatus(item.status) ? 'animate-spin' : ''}`} /></button>{item.imageUrl ? <button type="button" onClick={() => handleDownload(item.imageUrl!, index)} disabled={isWorkingStatus(item.status)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-pastel-muted hover:bg-blue-50 hover:text-blue-500 disabled:opacity-40" aria-label="下载"><Download className="h-4 w-4" /></button> : null}</div></div></article>)}</div> : <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center"><div className="flex h-16 w-16 items-center justify-center rounded-full bg-white"><ImageIcon className="h-8 w-8 text-pastel-border" /></div><p className="max-w-md text-sm leading-relaxed text-pastel-muted">上传 1–3 张同一模特的多角度参考图和最多 10 张目标场景图。开始后，各场景会同时提交并独立显示进度。</p></div>}
              </div>
              {isGenerating && statusMessage ? <p className="mt-3 text-center text-xs font-bold text-orange-600">{statusMessage}</p> : null}
            </section>
          </div>
        </div>
      </div>
      {selectedPreview ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setSelectedPreview(null)}><button type="button" onClick={() => setSelectedPreview(null)} className="absolute right-4 top-4 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/20 text-white" aria-label="关闭预览"><X className="h-6 w-6" /></button><img src={selectedPreview} alt="模特迁移预览" className="max-h-[85vh] max-w-full object-contain" /></div> : null}
    </div>
  );
};

export default ModelTransferTab;
