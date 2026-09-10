import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CreativeImageModelSelector from './image-models/CreativeImageModelSelector';
import {
  Aperture,
  Camera,
  Check,
  CheckCircle2,
  CircleStop,
  Download,
  Film,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  ScanLine,
  SlidersHorizontal,
  Sparkles,
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
import { downloadImageFile } from '../utils/imageDownload';
import { saveGeneratedProject } from '../../services/projectHistoryService';
import {
  FILM_PRESETS,
  FILM_STRENGTHS,
  PHOTOGRAPHY_CAMERAS,
  PHOTOGRAPHY_LENSES,
  buildPhotographyAnalysisPrompt,
  buildPhotographyGenerationPrompt,
  buildPhotographyQaPrompt,
  buildPhotographyRetryPrompt,
  getFilmPreset,
  getPhotographyCamera,
  getPhotographyLens,
  type FilmPresetId,
  type FilmStrength,
  type PhotographyCameraId,
  type PhotographyLensId,
  type PhotographyPreserveSettings,
} from '../constants/photographyLabPresets';

const MAX_IMAGES = 10;
const MAX_FILE_SIZE = 30 * 1024 * 1024;
const MAX_RECORDS = 20;
const DEFAULT_MODEL_ID = 'gemini-3.1-flash-image-preview';

const IMAGE_MODEL_OPTIONS = [
  { id: 'gemini-3.1-flash-image-preview', label: 'Gemini Banana 2', note: '快速稳定', badge: '默认' },
  { id: 'gpt-image-2', label: 'GPT Image 2', note: 'Ultra Quality', badge: 'GPT' },
  { id: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro', note: '专业细节', badge: 'Pro' },
  { id: 'qwen-image-3.0-pro', label: '千问3.0pro', note: '独立千问 API', badge: '千问' },
] as const;

const RATIO_OPTIONS: Array<{ id: AspectRatio; label: string }> = [
  { id: AspectRatio.PORTRAIT_3_4, label: '3:4 竖版' },
  { id: AspectRatio.PORTRAIT_2_3, label: '2:3 竖版' },
  { id: AspectRatio.LANDSCAPE_4_3, label: '4:3 横版' },
  { id: AspectRatio.SQUARE, label: '1:1 方版' },
  { id: AspectRatio.PORTRAIT_4_5, label: '4:5 竖版' },
  { id: AspectRatio.LANDSCAPE_5_4, label: '5:4 横版' },
  { id: AspectRatio.PORTRAIT_9_16, label: '9:16 竖屏' },
  { id: AspectRatio.LANDSCAPE_16_9, label: '16:9 横版' },
  { id: AspectRatio.LANDSCAPE_21_9, label: '21:9 超宽' },
];

interface LabImage {
  id: string;
  name: string;
  base64: string;
  mimeType: string;
  preview: string;
}

type LabResultStatus = 'queued' | 'processing' | 'done' | 'error';
type LabPhase = 'idle' | 'analyzing' | 'generating' | 'done';

interface LabResult {
  id: string;
  sourceId: string;
  status: LabResultStatus;
  imageUrl?: string;
  error?: string;
  attempts?: number;
  qa?: LabQaReport;
}

interface LabQaReport {
  pass: boolean;
  styleDeltaScore: number;
  contentFidelityScore: number;
  filmAccuracyScore: number;
  notes: string;
  correctionPrompt: string;
  unavailable?: boolean;
}

interface PhotographyLabRecord {
  id: string;
  createdAt: number;
  images: LabImage[];
  results: LabResult[];
  cameraId: PhotographyCameraId;
  lensId: PhotographyLensId;
  filmId: FilmPresetId;
  strength: FilmStrength;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
  modelId: string;
  preserve: PhotographyPreserveSettings;
  phase: LabPhase;
  colorAnchor: string;
  agentStage: string;
  agentLog: string[];
  error: string;
}

interface PhotographyLabTabProps {
  isActive?: boolean;
}

const STEPS: Array<{ phase: LabPhase; label: string }> = [
  { phase: 'idle', label: '1. 输入' },
  { phase: 'analyzing', label: '2. AI分析' },
  { phase: 'generating', label: '3. 应用预设' },
  { phase: 'done', label: '4. 完成' },
];

const createRecord = (): PhotographyLabRecord => ({
  id: crypto.randomUUID(),
  createdAt: Date.now(),
  images: [],
  results: [],
  cameraId: 'editorial-35mm',
  lensId: '40mm',
  filmId: 'costa-135',
  strength: 'standard',
  aspectRatio: AspectRatio.PORTRAIT_2_3,
  resolution: ImageResolution.RES_2K,
  modelId: DEFAULT_MODEL_ID,
  preserve: {
    identity: true,
    clothing: true,
    product: true,
    composition: true,
    collectionConsistency: true,
  },
  phase: 'idle',
  colorAnchor: '',
  agentStage: '等待上传摄影原片',
  agentLog: [],
  error: '',
});

const toApiImage = (image: LabImage) => ({ base64: image.base64, mimeType: image.mimeType });

const cleanAnalysisText = (value: string) => {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  return cleaned || '{"sharedCorrection":"Apply the selected camera and film profile consistently to the full collection."}';
};

const clampScore = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(100, Math.round(numeric))) : 0;
};

const parseQaReport = (value: string): LabQaReport => {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('质量审查 Agent 未返回有效 JSON。');
  const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  const styleDeltaScore = clampScore(parsed.styleDeltaScore);
  const contentFidelityScore = clampScore(parsed.contentFidelityScore);
  const filmAccuracyScore = clampScore(parsed.filmAccuracyScore);
  return {
    pass: parsed.pass === true && styleDeltaScore >= 40 && contentFidelityScore >= 80 && filmAccuracyScore >= 65,
    styleDeltaScore,
    contentFidelityScore,
    filmAccuracyScore,
    notes: typeof parsed.notes === 'string' ? parsed.notes : '质量审查已完成。',
    correctionPrompt: typeof parsed.correctionPrompt === 'string' ? parsed.correctionPrompt : '',
  };
};

const imageUrlToApiImage = async (imageUrl: string, signal: AbortSignal) => {
  const dataUrlMatch = imageUrl.match(/^data:([^;,]+);base64,(.+)$/s);
  if (dataUrlMatch) return { mimeType: dataUrlMatch[1], base64: dataUrlMatch[2] };

  const response = await fetch(imageUrl, { signal });
  if (!response.ok) throw new Error(`无法读取成片进行质量审查（${response.status}）。`);
  const blob = await response.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('无法读取成片。'));
    reader.readAsDataURL(blob);
  });
  const parsed = dataUrl.match(/^data:([^;,]+);base64,(.+)$/s);
  if (!parsed) throw new Error('成片格式无法进入质量审查。');
  return { mimeType: parsed[1] || blob.type || 'image/png', base64: parsed[2] };
};

const measurePixelDeltaScore = async (
  source: { base64: string; mimeType: string },
  generated: { base64: string; mimeType: string },
): Promise<number> => {
  const loadRaster = (image: { base64: string; mimeType: string }) => new Promise<Uint8ClampedArray>((resolve, reject) => {
    const element = new window.Image();
    element.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 48;
      canvas.height = 48;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) {
        reject(new Error('无法建立图像差异检测画布。'));
        return;
      }
      context.drawImage(element, 0, 0, canvas.width, canvas.height);
      resolve(context.getImageData(0, 0, canvas.width, canvas.height).data);
    };
    element.onerror = () => reject(new Error('无法读取图片进行差异检测。'));
    element.src = `data:${image.mimeType};base64,${image.base64}`;
  });

  const [sourcePixels, generatedPixels] = await Promise.all([loadRaster(source), loadRaster(generated)]);
  let totalDelta = 0;
  let channelCount = 0;
  for (let index = 0; index < sourcePixels.length; index += 4) {
    totalDelta += Math.abs(sourcePixels[index] - generatedPixels[index]);
    totalDelta += Math.abs(sourcePixels[index + 1] - generatedPixels[index + 1]);
    totalDelta += Math.abs(sourcePixels[index + 2] - generatedPixels[index + 2]);
    channelCount += 3;
  }
  const normalizedDelta = totalDelta / Math.max(1, channelCount * 255);
  return Math.min(100, Math.round(normalizedDelta * 1000));
};

const recordTitle = (record: PhotographyLabRecord) => {
  const sourceName = record.images[0]?.name?.replace(/\.[^.]+$/, '').trim();
  return sourceName || '未命名拍摄任务';
};

const RatioSelectionModal: React.FC<{
  value: AspectRatio;
  onSelect: (ratio: AspectRatio) => void;
  onClose: () => void;
}> = ({ value, onSelect, onClose }) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-[#10203a]/60 p-3 backdrop-blur-sm" onMouseDown={onClose}>
      <section className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[1.5rem] border border-white/60 bg-white shadow-2xl dark:border-white/10 dark:bg-[#15191f]" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex min-h-16 items-center justify-between border-b border-pastel-border px-5 sm:px-6">
          <h2 className="text-base font-black">选择尺寸比例</h2>
          <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-xl bg-pastel-bg text-pastel-muted" aria-label="关闭尺寸比例弹窗"><X className="h-5 w-5" /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {RATIO_OPTIONS.map((ratio) => {
              const [width, height] = ratio.id.split(':').map(Number);
              const scale = 70 / Math.max(width, height);
              const selected = value === ratio.id;
              return (
                <button
                  key={ratio.id}
                  type="button"
                  onClick={() => onSelect(ratio.id)}
                  className={`relative flex min-h-44 flex-col items-center justify-center rounded-2xl border-2 p-4 transition hover:-translate-y-0.5 ${selected ? 'border-[#17243c] bg-[#eef5ff] shadow-md' : 'border-transparent bg-[#eef5ff] hover:border-[#c7d6e6]'}`}
                >
                  <span className="block rounded border-[3px] border-[#7a8492]" style={{ width: Math.max(24, width * scale), height: Math.max(24, height * scale) }} />
                  <strong className="mt-4 text-sm font-black text-[#17243c] sm:text-base">{ratio.label}</strong>
                  {selected ? <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-[#17243c]" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};

const PhotographyLabTab: React.FC<PhotographyLabTabProps> = ({ isActive = true }) => {
  const initialRecordRef = useRef<PhotographyLabRecord>(createRecord());
  const [records, setRecords] = useState<PhotographyLabRecord[]>([initialRecordRef.current]);
  const [activeRecordId, setActiveRecordId] = useState(initialRecordRef.current.id);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [isRatioModalOpen, setIsRatioModalOpen] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    cancelMessage,
    setCancelMessage,
    startGenerationTask,
    cancelGenerationTask,
    assertCurrentGenerationTask,
    finishGenerationTask,
  } = useCancelableGeneration();

  const activeRecord = records.find((record) => record.id === activeRecordId) || records[0];
  const camera = useMemo(() => getPhotographyCamera(activeRecord.cameraId), [activeRecord.cameraId]);
  const lens = useMemo(() => getPhotographyLens(activeRecord.lensId), [activeRecord.lensId]);
  const filmPreset = useMemo(() => getFilmPreset(activeRecord.filmId), [activeRecord.filmId]);
  const availableLenses = useMemo(
    () => PHOTOGRAPHY_LENSES.filter((item) => camera.allowedLensIds.includes(item.id)),
    [camera],
  );
  const busy = activeRecord.phase === 'analyzing' || activeRecord.phase === 'generating';
  const completedCount = activeRecord.results.filter((result) => result.status === 'done').length;
  const failedCount = activeRecord.results.filter((result) => result.status === 'error').length;
  const selectedImageModel = IMAGE_MODEL_OPTIONS.find((model) => model.id === activeRecord.modelId) || IMAGE_MODEL_OPTIONS[0];

  const updateRecord = useCallback((id: string, updater: (record: PhotographyLabRecord) => PhotographyLabRecord) => {
    setRecords((current) => current.map((record) => (record.id === id ? updater(record) : record)));
  }, []);

  const updateActive = useCallback((updater: (record: PhotographyLabRecord) => PhotographyLabRecord) => {
    updateRecord(activeRecordId, updater);
  }, [activeRecordId, updateRecord]);

  const resetOutput = useCallback(() => {
    updateActive((record) => ({ ...record, results: [], colorAnchor: '', agentStage: '等待执行摄影预设', agentLog: [], error: '', phase: 'idle' }));
    setCancelMessage(null);
  }, [setCancelMessage, updateActive]);

  const startNewRecord = () => {
    if (busy) return;
    const next = createRecord();
    setRecords((current) => [next, ...current].slice(0, MAX_RECORDS));
    setActiveRecordId(next.id);
    setCancelMessage(null);
  };

  const deleteRecord = (id: string) => {
    if (busy) return;
    const next = records.filter((record) => record.id !== id);
    if (!next.length) {
      const replacement = createRecord();
      setRecords([replacement]);
      setActiveRecordId(replacement.id);
      return;
    }
    setRecords(next);
    if (id === activeRecordId) setActiveRecordId(next[0].id);
  };

  const handleFiles = useCallback(async (files: File[]) => {
    if (busy) return;
    const remaining = Math.max(0, MAX_IMAGES - activeRecord.images.length);
    const accepted = files
      .filter((file) => file.type.startsWith('image/'))
      .filter((file) => file.size <= MAX_FILE_SIZE)
      .slice(0, remaining);

    if (!accepted.length) {
      updateActive((record) => ({
        ...record,
        error: remaining === 0 ? `最多上传 ${MAX_IMAGES} 张图片。` : '请选择 30MB 以内的 JPG、PNG 或 WebP 图片。',
      }));
      return;
    }

    try {
      const uploaded = await Promise.all(accepted.map(async (file): Promise<LabImage> => {
        const compressed = await compressImage(file, 2048, 0.92);
        return {
          id: crypto.randomUUID(),
          name: file.name || `摄影原片-${Date.now()}.png`,
          base64: compressed.base64,
          mimeType: compressed.mime,
          preview: `data:${compressed.mime};base64,${compressed.base64}`,
        };
      }));
      updateActive((record) => ({
        ...record,
        images: [...record.images, ...uploaded],
        results: [],
        colorAnchor: '',
        agentStage: '等待执行摄影预设',
        agentLog: [],
        error: '',
        phase: 'idle',
      }));
      setCancelMessage(null);
    } catch (uploadError) {
      updateActive((record) => ({ ...record, error: `图片处理失败：${getErrorMessage(uploadError)}` }));
    }
  }, [activeRecord.images.length, busy, setCancelMessage, updateActive]);

  useImagePaste(handleFiles, isActive && !busy);

  const removeImage = (id: string) => {
    if (busy) return;
    updateActive((record) => ({
      ...record,
      images: record.images.filter((image) => image.id !== id),
      results: [],
      colorAnchor: '',
      agentStage: '等待执行摄影预设',
      agentLog: [],
      error: '',
      phase: 'idle',
    }));
  };

  const chooseCamera = (cameraId: PhotographyCameraId) => {
    if (busy) return;
    const nextCamera = getPhotographyCamera(cameraId);
    updateActive((record) => ({
      ...record,
      cameraId,
      lensId: nextCamera.defaultLensId,
      results: [],
      colorAnchor: '',
      agentStage: '等待执行摄影预设',
      agentLog: [],
      error: '',
      phase: 'idle',
    }));
  };

  const applyPreset = async () => {
    if (!activeRecord.images.length || busy) return;
    const snapshot = activeRecord;
    const snapshotCamera = getPhotographyCamera(snapshot.cameraId);
    const snapshotLens = getPhotographyLens(snapshot.lensId);
    const snapshotFilm = getFilmPreset(snapshot.filmId);
    const { taskId, signal } = startGenerationTask();
    updateRecord(snapshot.id, (record) => ({
      ...record,
      error: '',
      results: snapshot.images.map((image) => ({ id: crypto.randomUUID(), sourceId: image.id, status: 'queued' })),
      phase: 'analyzing',
      agentStage: '原片诊断 Agent · 正在读取整组曝光、白平衡与光线',
      agentLog: ['已接收原片，开始建立整组摄影诊断。'],
    }));

    try {
      const analysis = await generateText(
        snapshot.images.map(toApiImage),
        buildPhotographyAnalysisPrompt(snapshotCamera, snapshotLens, snapshotFilm),
      );
      assertCurrentGenerationTask(taskId, signal);
      const sharedAnchor = cleanAnalysisText(analysis);
      updateRecord(snapshot.id, (record) => ({
        ...record,
        colorAnchor: sharedAnchor,
        phase: 'generating',
        agentStage: `预设规划 Agent · 已生成 ${snapshotFilm.name} 执行方案`,
        agentLog: [...record.agentLog, `已按 ${snapshotCamera.name}、${snapshotLens.name} 与 ${snapshotFilm.name} 生成可执行参数。`],
      }));

      const reviewGeneratedImage = async (source: LabImage, imageUrl: string, itemIndex: number): Promise<LabQaReport> => {
        try {
          const generatedImage = await imageUrlToApiImage(imageUrl, signal);
          const pixelDeltaScore = await measurePixelDeltaScore(toApiImage(source), generatedImage);
          if (pixelDeltaScore < 12) {
            return {
              pass: false,
              styleDeltaScore: pixelDeltaScore,
              contentFidelityScore: 100,
              filmAccuracyScore: 0,
              notes: `确定性像素检测仅 ${pixelDeltaScore} 分，返回图片与原片相同或几乎相同。`,
              correctionPrompt: 'The previous output is effectively the unchanged source image. Apply a substantially stronger full-frame COSTA 135 exposure, lighting, color curve, cyan-gray shadow, warm highlight and organic grain transformation.',
            };
          }
          const qaText = await generateText(
            [toApiImage(source), generatedImage],
            buildPhotographyQaPrompt({
              camera: snapshotCamera,
              lens: snapshotLens,
              film: snapshotFilm,
              strength: snapshot.strength,
              itemIndex,
            }),
          );
          assertCurrentGenerationTask(taskId, signal);
          const report = parseQaReport(qaText);
          const styleDeltaScore = Math.min(report.styleDeltaScore, pixelDeltaScore);
          return {
            ...report,
            styleDeltaScore,
            pass: report.pass && styleDeltaScore >= 40,
            notes: `${report.notes}（像素差异 ${pixelDeltaScore}）`,
          };
        } catch (qaError) {
          if (isAbortError(qaError)) throw qaError;
          return {
            pass: false,
            styleDeltaScore: 0,
            contentFidelityScore: 0,
            filmAccuracyScore: 0,
            notes: `质量审查暂不可用：${getErrorMessage(qaError)}`,
            correctionPrompt: '',
            unavailable: true,
          };
        }
      };

      const generated: LabResult[] = new Array(snapshot.images.length);
      let nextImageIndex = 0;
      const renderNextImage = async (): Promise<void> => {
        const index = nextImageIndex;
        nextImageIndex += 1;
        if (index >= snapshot.images.length) return;
        const source = snapshot.images[index];
        updateRecord(snapshot.id, (record) => ({
          ...record,
          agentStage: `生成 Agent · 正在处理第 ${index + 1}/${snapshot.images.length} 张`,
          results: record.results.map((result) => (
            result.sourceId === source.id ? { ...result, status: 'processing', error: undefined } : result
          )),
        }));

        try {
          const prompt = buildPhotographyGenerationPrompt({
            camera: snapshotCamera,
            lens: snapshotLens,
            film: snapshotFilm,
            strength: snapshot.strength,
            preserve: snapshot.preserve,
            colorAnchor: sharedAnchor,
            userDirection: '',
            itemIndex: index,
            itemCount: snapshot.images.length,
          });
          const generationOptions = {
            aspectRatio: snapshot.aspectRatio,
            resolution: snapshot.resolution,
            modelId: snapshot.modelId,
            negativePrompt: snapshotFilm.negativePrompt,
            workflowHint: 'photography-preset' as const,
            signal,
          };
          const [imageUrl] = await generateImageToImage([toApiImage(source)], prompt, generationOptions);
          if (!imageUrl) throw new Error('模型未返回图片。');

          updateRecord(snapshot.id, (record) => ({
            ...record,
            agentStage: `质量审查 Agent · 正在比较第 ${index + 1} 张原片与成片`,
          }));
          let finalImageUrl = imageUrl;
          let attempts = 1;
          let qa = await reviewGeneratedImage(source, finalImageUrl, index);

          if (!qa.pass && !qa.unavailable) {
            updateRecord(snapshot.id, (record) => ({
              ...record,
              agentStage: `返工 Agent · 第 ${index + 1} 张未达标，正在自动增强预设`,
              agentLog: [...record.agentLog, `第 ${index + 1} 张首次 QA 未通过（风格差异 ${qa.styleDeltaScore} / 胶片准确 ${qa.filmAccuracyScore}），已自动返工。`],
            }));
            const retryPrompt = buildPhotographyRetryPrompt({
              originalPrompt: prompt,
              qaCorrection: qa.correctionPrompt,
              film: snapshotFilm,
            });
            const [retriedImageUrl] = await generateImageToImage([toApiImage(source)], retryPrompt, generationOptions);
            if (!retriedImageUrl) throw new Error('返工 Agent 未返回图片。');
            finalImageUrl = retriedImageUrl;
            attempts = 2;
            updateRecord(snapshot.id, (record) => ({
              ...record,
              agentStage: `质量审查 Agent · 正在复检第 ${index + 1} 张返工成片`,
            }));
            qa = await reviewGeneratedImage(source, finalImageUrl, index);
          }

          if (!qa.pass && !qa.unavailable) {
            throw new Error(`质量审查未通过：${qa.notes} 已自动返工一次，但结果仍未达到可见的 ${snapshotFilm.name} 变化，未将原片复制品标记为成片。`);
          }

          const completedResult: LabResult = {
            id: crypto.randomUUID(),
            sourceId: source.id,
            status: 'done',
            imageUrl: finalImageUrl,
            attempts,
            qa,
          };
          generated[index] = completedResult;
          updateRecord(snapshot.id, (record) => ({
            ...record,
            agentLog: [
              ...record.agentLog,
              qa.unavailable
                ? `第 ${index + 1} 张已生成，但自动 QA 暂不可用。`
                : `第 ${index + 1} 张 QA ${qa.pass ? '通过' : '需人工复核'}：风格差异 ${qa.styleDeltaScore}，内容保真 ${qa.contentFidelityScore}，胶片准确 ${qa.filmAccuracyScore}。`,
            ],
            results: record.results.map((result) => (result.sourceId === source.id ? completedResult : result)),
          }));
        } catch (generationError) {
          if (isAbortError(generationError)) throw generationError;
          const failedResult: LabResult = {
            id: crypto.randomUUID(),
            sourceId: source.id,
            status: 'error',
            error: getErrorMessage(generationError),
          };
          generated[index] = failedResult;
          updateRecord(snapshot.id, (record) => ({
            ...record,
            results: record.results.map((result) => (result.sourceId === source.id ? failedResult : result)),
          }));
        }
        await renderNextImage();
      };

      await Promise.all(Array.from({ length: Math.min(2, snapshot.images.length) }, () => renderNextImage()));
      assertCurrentGenerationTask(taskId, signal);
      updateRecord(snapshot.id, (record) => ({
        ...record,
        results: generated,
        phase: 'done',
        agentStage: '摄影预设 Agent · 批次处理完成',
        agentLog: [...record.agentLog, '整组生成与质量审查已完成。'],
      }));

      const successful = generated.filter((item): item is LabResult & { imageUrl: string } => (
        item.status === 'done' && Boolean(item.imageUrl)
      ));
      if (successful.length) {
        await saveGeneratedProject({
          type: 'OTHER',
          generated: successful.map((item) => item.imageUrl),
          original: snapshot.images.map((image) => image.preview),
          prompt: `${snapshotFilm.name} / ${snapshotCamera.name} / ${snapshotLens.name}`,
          thumbnail: successful[0].imageUrl,
          params: {
            source: 'Cyzx4/components/PhotographyLabTab',
            subType: 'photography_preset_lab',
            cameraId: snapshot.cameraId,
            lensId: snapshot.lensId,
            filmId: snapshot.filmId,
            strength: snapshot.strength,
            aspectRatio: snapshot.aspectRatio,
            resolution: snapshot.resolution,
            modelId: snapshot.modelId,
            preserve: snapshot.preserve,
            colorAnchor: sharedAnchor,
            qa: successful.map((item) => item.qa),
          },
        });
      }
    } catch (runError) {
      if (isAbortError(runError)) {
        updateRecord(snapshot.id, (record) => ({ ...record, phase: 'idle', agentStage: '任务已中止' }));
      } else {
        updateRecord(snapshot.id, (record) => ({
          ...record,
          error: `摄影预设执行失败：${getErrorMessage(runError)}`,
          phase: 'idle',
          agentStage: '摄影预设 Agent · 执行失败',
        }));
      }
    } finally {
      finishGenerationTask(taskId);
    }
  };

  const historyPanel = (
    <aside className="flex h-full flex-col rounded-2xl border border-[#d8e3ee] bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#11151c]">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-base font-black">生成记录</h2>
          <p className="mt-0.5 text-xs text-pastel-muted">当前会话最多20项</p>
        </div>
        <button type="button" onClick={() => setIsHistoryOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-pastel-border text-pastel-muted" aria-label="收起生成记录"><PanelLeftClose className="h-4 w-4" /></button>
      </div>
      <button type="button" onClick={startNewRecord} disabled={busy} className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#17243c] text-sm font-black text-white disabled:opacity-40"><Plus className="h-4 w-4" />新开任务</button>
      <div className="mt-3 flex-1 space-y-2 overflow-y-auto">
        {records.map((record) => {
          const recordCamera = getPhotographyCamera(record.cameraId);
          const recordFilm = getFilmPreset(record.filmId);
          const stepLabel = record.phase === 'done' ? '4. 完成' : record.phase === 'generating' ? '3. 生成中' : record.phase === 'analyzing' ? '2. AI分析' : '1. 输入';
          return (
            <button key={record.id} type="button" disabled={busy && record.id !== activeRecord.id} onClick={() => setActiveRecordId(record.id)} className={`group relative w-full overflow-hidden rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${record.id === activeRecord.id ? 'border-[#ed6d46] bg-[#fff8f3]' : 'border-pastel-border bg-pastel-bg/40 hover:border-[#efb49d]'}`}>
              <div className="flex items-start justify-between gap-2"><span className="truncate text-xs font-black">{recordTitle(record)}</span><span className="shrink-0 rounded-full bg-white px-2 py-1 text-[0.62rem] font-bold text-pastel-muted">{stepLabel}</span></div>
              <div className="mt-2 flex items-center justify-between text-[0.68rem] text-pastel-muted"><span>{recordFilm.name} · {recordCamera.name}</span><span>{new Date(record.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
              <span role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); deleteRecord(record.id); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.stopPropagation(); deleteRecord(record.id); } }} className="absolute bottom-2 right-2 hidden h-8 w-8 items-center justify-center rounded-lg bg-white text-red-400 shadow group-hover:flex" aria-label="删除记录"><Trash2 className="h-3.5 w-3.5" /></span>
            </button>
          );
        })}
      </div>
    </aside>
  );

  return (
    <div className="h-full overflow-y-auto bg-[#eef6ff] text-pastel-text dark:bg-[#080a0d]">
      <div className="mx-auto w-full max-w-[105rem] px-3 py-5 sm:px-5 lg:px-8">
        <header className="relative mb-5 overflow-hidden rounded-[1.75rem] border border-[#d9e5f1] bg-white px-4 py-6 shadow-[0_14px_45px_rgba(33,66,104,0.07)] dark:border-white/10 dark:bg-[#11151c] sm:px-7 sm:py-7">
          <div className="absolute -right-16 -top-24 h-56 w-56 rounded-full border-[2rem] border-[#edf5fd] bg-[#fff2e9] dark:border-white/[0.03] dark:bg-[#ed6d46]/5" />
          <div className="relative text-center">
            <div className="inline-flex items-center gap-2 text-xs font-black tracking-[0.14em] text-[#6f8199]"><Aperture className="h-4 w-4 text-[#ed6d46]" />AI 摄影实验 Agent</div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-[#142139] dark:text-white sm:text-3xl">摄影实验室</h1>
            <p className="mx-auto mt-2 max-w-3xl text-sm leading-6 text-pastel-muted">上传摄影原片，选择相机、镜头与胶片风格，把整组照片统一为同一天、同一摄影师完成的商业成片。</p>
            <div className="mx-auto mt-5 flex max-w-2xl items-center justify-center">
              {STEPS.map((step, index) => {
                const currentIndex = STEPS.findIndex((item) => item.phase === activeRecord.phase);
                const active = index <= currentIndex;
                return (
                  <React.Fragment key={step.phase}>
                    <div className={`flex shrink-0 items-center gap-2 text-xs font-black ${active ? 'text-[#17243c] dark:text-white' : 'text-[#9aabc0]'}`}><span className={`flex h-7 w-7 items-center justify-center rounded-full border ${active ? 'border-[#17243c] bg-[#17243c] text-white' : 'border-[#d6e2ee] bg-white'}`}>{index + 1}</span><span className="hidden sm:inline">{step.label}</span></div>
                    {index < STEPS.length - 1 ? <span className="mx-2 h-px min-w-4 flex-1 bg-[#d7e3ef] sm:mx-3" /> : null}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </header>

        {!isHistoryOpen ? (
          <button type="button" onClick={() => setIsHistoryOpen(true)} className="fixed bottom-5 left-4 z-40 flex min-h-12 items-center gap-2 rounded-full border border-pastel-border bg-white px-4 text-sm font-black shadow-[0_8px_24px_rgba(30,50,80,0.16)] md:left-[16.25rem] lg:left-[17rem]"><PanelLeftOpen className="h-4 w-4 text-[#ed6d46]" />生成记录<span className="rounded-full bg-pastel-bg px-2 py-1 text-xs text-pastel-muted">{records.length}</span></button>
        ) : null}
        {isHistoryOpen ? <button type="button" className="fixed inset-0 z-[69] bg-[#10203a]/35 xl:hidden" onClick={() => setIsHistoryOpen(false)} aria-label="关闭生成记录" /> : null}

        <div className={`grid grid-cols-1 gap-5 ${isHistoryOpen ? 'xl:grid-cols-[17rem_minmax(23rem,31rem)_minmax(0,1fr)]' : 'xl:grid-cols-[minmax(23rem,31rem)_minmax(0,1fr)]'}`}>
          {isHistoryOpen ? <div className="fixed inset-y-3 left-3 z-[70] w-[min(18rem,calc(100vw-1.5rem))] xl:sticky xl:top-4 xl:z-10 xl:h-[calc(100vh-7rem)] xl:w-auto xl:self-start">{historyPanel}</div> : null}

          <div className="flex min-w-0 flex-col gap-4">
            <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c] sm:p-5">
              <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-black">生成模型</h2><p className="mt-1 text-xs leading-5 text-pastel-muted">默认使用Gemini Banana 2，也可切换GPT Image 2或Gemini 3 Pro。</p></div><span className="rounded-full bg-[#fff0e8] px-2.5 py-1 text-[0.65rem] font-black text-[#d8552e]">{selectedImageModel.badge}</span></div>
              <CreativeImageModelSelector value={activeRecord.modelId} onChange={(modelId) => updateActive((record) => ({ ...record, modelId, results: [], phase: 'idle' }))} disabled={busy} title="" compact className="mt-4 border-0 bg-transparent p-0 shadow-none" />
              <div className="hidden">
                {IMAGE_MODEL_OPTIONS.map((model) => {
                  const selected = activeRecord.modelId === model.id;
                  return <button key={model.id} type="button" disabled={busy} onClick={() => updateActive((record) => ({ ...record, modelId: model.id, results: [], phase: 'idle' }))} className={`relative flex min-h-20 items-center gap-2.5 rounded-xl border p-2.5 text-left transition hover:-translate-y-0.5 disabled:opacity-50 ${selected ? 'border-[#ed6d46] bg-gradient-to-br from-[#fff7f2] to-[#eef5ff] shadow-[0_8px_20px_rgba(237,109,70,0.12)]' : 'border-pastel-border bg-pastel-bg/60 hover:border-[#efb49d]'}`}><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${model.id === 'gpt-image-2' ? 'bg-[#17243c] text-white' : 'bg-[#e8f2ff] text-[#2d6bb1]'}`}><Sparkles className="h-4 w-4" /></span><span className="min-w-0 pr-3"><strong className="block text-xs font-black leading-snug text-[#17243c]">{model.label}</strong><small className="mt-0.5 block text-[0.68rem] text-pastel-muted">{model.note}</small></span>{selected ? <CheckCircle2 className="absolute right-2 top-2 h-4 w-4 text-[#ed6d46]" /> : null}</button>;
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-[#2d6bb1]/40 bg-white p-4 shadow-sm ring-1 ring-[#2d6bb1]/20 dark:bg-[#11151c] sm:p-5">
              <div className="flex items-start justify-between gap-3"><div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf3ff] text-[#2d6bb1]"><ImageIcon className="h-5 w-5" /></span><div><h3 className="flex items-center gap-2 text-sm font-black">摄影原片<span className="rounded bg-[#eaf3ff] px-1.5 py-0.5 text-[10px] font-bold text-[#2d6bb1]">当前粘贴目标</span></h3><p className="mt-1 text-xs leading-5 text-pastel-muted">同一组拍摄的原片，系统先建立共享 Color Anchor。</p></div></div><span className="text-xs font-bold text-pastel-muted">{activeRecord.images.length}/{MAX_IMAGES}</span></div>
              {activeRecord.images.length ? <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-5">{activeRecord.images.map((image, index) => <div key={image.id} className="group relative aspect-square overflow-hidden rounded-xl border border-pastel-border bg-pastel-bg"><img src={image.preview} alt={image.name} onClick={() => setSelectedPreview(image.preview)} className="h-full w-full cursor-pointer object-cover transition hover:scale-105" /><span className="pointer-events-none absolute bottom-1 left-1 rounded bg-[#17243c] px-1.5 py-1 text-[0.55rem] font-black text-white">{index === 0 ? '主原片' : index + 1}</span><button type="button" disabled={busy} onClick={() => removeImage(image.id)} className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#17243c]/85 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100" aria-label={`删除${image.name}`}><X className="h-3.5 w-3.5" /></button></div>)}</div> : null}
              {activeRecord.images.length < MAX_IMAGES ? <button type="button" disabled={busy} onClick={() => fileInputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void handleFiles(Array.from(event.dataTransfer.files || [])); }} className="mt-4 flex min-h-32 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cbd8e8] bg-[#f8fbff] px-4 text-center transition hover:border-[#ed6d46] disabled:opacity-50"><Upload className="h-6 w-6 text-[#ed6d46]" /><span className="mt-2 text-sm font-black">拖拽、点击或Ctrl+V粘贴图片</span><span className="mt-1 text-xs text-pastel-muted">JPG / JPEG / PNG / WEBP · 单张≤30MB</span></button> : null}
              <input ref={fileInputRef} type="file" multiple accept="image/*,.jpg,.jpeg,.png,.webp" className="hidden" onChange={(event) => { void handleFiles(Array.from(event.target.files || [])); event.target.value = ''; }} />
            </section>

            <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c] sm:p-5">
              <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf3ff] text-[#2d6bb1]"><Camera className="h-5 w-5" /></span><div><h3 className="text-sm font-black">相机与镜头</h3><p className="mt-1 text-xs text-pastel-muted">相机决定画面响应，镜头决定透视与空间关系。</p></div></div>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">{PHOTOGRAPHY_CAMERAS.map((item) => { const selected = activeRecord.cameraId === item.id; return <button key={item.id} type="button" disabled={busy} onClick={() => chooseCamera(item.id)} className={`relative min-h-24 rounded-xl border p-3 text-left transition ${selected ? 'border-[#ed6d46] bg-gradient-to-br from-[#fff7f2] to-[#eef5ff]' : 'border-pastel-border bg-pastel-bg/50'}`}><strong className="block pr-4 text-xs text-[#17243c]">{item.name}</strong><span className="mt-1 block text-[0.68rem] text-pastel-muted">{item.format}</span><span className="mt-2 block text-[0.65rem] font-bold text-[#d8552e]">{item.character}</span>{selected ? <CheckCircle2 className="absolute right-2 top-2 h-4 w-4 text-[#ed6d46]" /> : null}</button>; })}</div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{availableLenses.map((item) => <button key={item.id} type="button" disabled={busy} onClick={() => updateActive((record) => ({ ...record, lensId: item.id, results: [], phase: 'idle' }))} className={`min-h-16 rounded-xl border px-3 text-left ${activeRecord.lensId === item.id ? 'border-[#ed6d46] bg-[#fff3ed] text-[#d8552e]' : 'border-pastel-border bg-pastel-bg/40'}`}><strong className="block text-sm">{item.name}</strong><span className="mt-1 block text-[0.65rem] opacity-65">{item.character}</span></button>)}</div>
            </section>

            <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c] sm:p-5">
              <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff0e8] text-[#ed6d46]"><Film className="h-5 w-5" /></span><div><h3 className="text-sm font-black">胶片风格</h3><p className="mt-1 text-xs text-pastel-muted">后续可继续增加预设。</p></div></div><span className="rounded-full bg-[#fff0e8] px-2.5 py-1 text-[0.65rem] font-black text-[#d8552e]">{FILM_PRESETS.length} 个可用</span></div>
              <div className="mt-4 space-y-3">{FILM_PRESETS.map((item) => <button key={item.id} type="button" disabled={busy} onClick={() => updateActive((record) => ({ ...record, filmId: item.id, results: [], phase: 'idle' }))} className={`w-full overflow-hidden rounded-xl border text-left ${activeRecord.filmId === item.id ? 'border-[#ed6d46] ring-2 ring-[#ed6d46]/10' : 'border-pastel-border'}`}><span className="block h-16" style={{ background: `linear-gradient(115deg, ${item.palette[0]}, ${item.palette[1]} 42%, ${item.palette[2]} 72%, ${item.palette[3]})` }} /><span className="flex items-start justify-between gap-3 p-3"><span><strong className="block text-sm font-black text-[#17243c]">{item.name}</strong><small className="mt-1 block text-xs text-pastel-muted">{item.subtitle} · ISO {item.iso}</small></span>{activeRecord.filmId === item.id ? <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ed6d46] text-white"><Check className="h-4 w-4" /></span> : null}</span></button>)}</div>
            </section>

            <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c] sm:p-5">
              <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf3ff] text-[#2d6bb1]"><SlidersHorizontal className="h-5 w-5" /></span><div><h3 className="text-sm font-black">输出设置</h3><p className="mt-1 text-xs text-pastel-muted">默认尺寸比例为 2:3 竖版。</p></div></div>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <label className="text-xs font-black">
                  尺寸比例
                  <button type="button" disabled={busy} onClick={() => setIsRatioModalOpen(true)} className="mt-2 flex min-h-12 w-full items-center justify-between rounded-xl border border-pastel-border bg-[#eef5ff] px-3 text-left text-xs transition hover:border-[#2d6bb1] disabled:opacity-50">
                    <span>{RATIO_OPTIONS.find((ratio) => ratio.id === activeRecord.aspectRatio)?.label || activeRecord.aspectRatio}</span>
                    <span className="text-pastel-muted">›</span>
                  </button>
                </label>
                <label className="text-xs font-black">分辨率<select value={activeRecord.resolution} disabled={busy} onChange={(event) => updateActive((record) => ({ ...record, resolution: event.target.value as ImageResolution, results: [], phase: 'idle' }))} className="mt-2 min-h-12 w-full rounded-xl border border-pastel-border bg-[#eef5ff] px-2 text-xs"><option value={ImageResolution.RES_1K}>1K</option><option value={ImageResolution.RES_2K}>2K（默认）</option><option value={ImageResolution.RES_4K}>4K</option></select></label>
                <label className="text-xs font-black">预设强度<select value={activeRecord.strength} disabled={busy} onChange={(event) => updateActive((record) => ({ ...record, strength: event.target.value as FilmStrength, results: [], phase: 'idle' }))} className="mt-2 min-h-12 w-full rounded-xl border border-pastel-border bg-[#eef5ff] px-2 text-xs">{FILM_STRENGTHS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
              </div>
            </section>

            {busy ? <button type="button" onClick={() => cancelGenerationTask('已中止摄影预设任务')} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-red-500 text-sm font-black text-white"><CircleStop className="h-5 w-5" />中止任务</button> : <button type="button" onClick={() => void applyPreset()} disabled={!activeRecord.images.length} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#17243c] text-sm font-black text-white shadow-[0_14px_28px_rgba(23,36,60,0.18)] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"><WandSparkles className="h-5 w-5 text-[#ed6d46]" />分析原片，应用 {filmPreset.name}</button>}
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {activeRecord.error ? <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{activeRecord.error}</div> : null}
            {cancelMessage ? <div className="rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm text-orange-700">{cancelMessage}</div> : null}

            {activeRecord.phase === 'done' && activeRecord.agentLog.length ? (
              <section className="rounded-2xl border border-[#d8e3ee] bg-white p-4 shadow-sm dark:bg-[#11151c] sm:p-5">
                <div className="flex items-center gap-2 text-sm font-black text-[#17243c] dark:text-white"><Sparkles className="h-4 w-4 text-[#ed6d46]" />摄影预设 Agent 执行报告</div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {activeRecord.results.map((result, index) => (
                    <div key={result.id} className={`rounded-xl border px-3 py-2.5 ${result.qa?.pass ? 'border-emerald-200 bg-emerald-50' : result.qa?.unavailable ? 'border-slate-200 bg-slate-50' : 'border-amber-200 bg-amber-50'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-xs">成片 {String(index + 1).padStart(2, '0')}</strong>
                        <span className={`rounded-full px-2 py-1 text-[0.62rem] font-black ${result.qa?.pass ? 'bg-emerald-600 text-white' : result.qa?.unavailable ? 'bg-slate-500 text-white' : 'bg-amber-500 text-white'}`}>{result.status === 'error' ? '生成失败' : result.qa?.pass ? 'QA 通过' : result.qa?.unavailable ? 'QA 不可用' : '需复核'}</span>
                      </div>
                      {result.qa && !result.qa.unavailable ? <div className="mt-2 grid grid-cols-3 gap-1 text-[0.65rem] font-bold text-pastel-muted"><span>差异 {result.qa.styleDeltaScore}</span><span>保真 {result.qa.contentFidelityScore}</span><span>胶片 {result.qa.filmAccuracyScore}</span></div> : null}
                      {result.qa ? <p className="mt-1.5 text-[0.68rem] leading-5 text-pastel-muted">{result.qa.notes}</p> : null}
                      {result.attempts === 2 ? <p className="mt-1 text-[0.65rem] font-bold text-[#d8552e]">首次未达标，Agent 已自动返工 1 次</p> : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {activeRecord.phase === 'idle' && !activeRecord.results.length ? <section className="flex min-h-[48rem] flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#cedbe8] bg-white/75 p-8 text-center"><span className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-[#fff1e8] text-[#ed6d46]"><Aperture className="h-9 w-9" /></span><h2 className="mt-5 text-xl font-black text-[#17243c]">先上传原片，再选择摄影系统</h2><p className="mt-2 max-w-lg text-sm leading-7 text-pastel-muted">Agent会先分析整组曝光、白平衡与光线，再统一应用相机、镜头和胶片响应；确认参数后才生成成片。</p><div className="mt-6 grid w-full max-w-xl gap-3 sm:grid-cols-3"><div className="rounded-xl bg-white p-3 text-left shadow-sm"><Camera className="h-4 w-4 text-[#ed6d46]" /><strong className="mt-2 block text-xs">可扩展相机系统</strong></div><div className="rounded-xl bg-white p-3 text-left shadow-sm"><Film className="h-4 w-4 text-[#2d6bb1]" /><strong className="mt-2 block text-xs">可扩展胶片风格</strong></div><div className="rounded-xl bg-white p-3 text-left shadow-sm"><ScanLine className="h-4 w-4 text-emerald-600" /><strong className="mt-2 block text-xs">默认 2:3 竖版</strong></div></div></section> : null}

            {busy ? <section className="flex min-h-[48rem] flex-1 flex-col items-center justify-center rounded-2xl border border-pastel-border bg-white p-8 text-center shadow-sm"><div className="relative flex h-24 w-24 items-center justify-center"><span className="absolute inset-0 animate-ping rounded-full bg-[#ed6d46]/10" /><span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[#17243c] text-white"><Loader2 className="h-7 w-7 animate-spin" /></span></div><h2 className="mt-6 text-xl font-black">{activeRecord.agentStage}</h2><p className="mt-2 max-w-md text-sm leading-7 text-pastel-muted">{activeRecord.phase === 'analyzing' ? '先诊断原片，再生成本次相机、镜头与胶片的专属执行方案。' : `生成、视觉 QA 与自动返工进度 ${completedCount}/${activeRecord.images.length}`}</p><div className="mt-5 w-full max-w-2xl rounded-2xl border border-[#d8e3ee] bg-[#f7faff] p-4 text-left"><div className="mb-2 flex items-center gap-2 text-xs font-black text-[#2d6bb1]"><Sparkles className="h-4 w-4" />Agent 执行记录</div><div className="max-h-28 space-y-1.5 overflow-y-auto">{activeRecord.agentLog.slice(-5).map((entry, logIndex) => <p key={`${logIndex}-${entry}`} className="text-xs leading-5 text-pastel-muted">{entry}</p>)}</div></div><div className="mt-8 grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{activeRecord.images.map((image) => { const result = activeRecord.results.find((item) => item.sourceId === image.id); return <div key={image.id} className="relative aspect-[2/3] overflow-hidden rounded-xl border border-pastel-border bg-[#eef5ff]"><img src={image.preview} alt={image.name} className="h-full w-full object-cover opacity-60" /><div className="absolute inset-0 flex items-center justify-center bg-white/20">{result?.status === 'done' ? <span className={`flex h-10 w-10 items-center justify-center rounded-full text-white ${result.qa?.pass ? 'bg-emerald-500' : 'bg-amber-500'}`}><Check className="h-6 w-6" /></span> : result?.status === 'error' ? <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white"><X className="h-6 w-6" /></span> : <Loader2 className="h-6 w-6 animate-spin text-[#ed6d46]" />}</div></div>; })}</div></section> : null}

            {activeRecord.phase === 'done' && activeRecord.results.length ? <section className="rounded-2xl border border-pastel-border bg-white p-4 shadow-sm dark:bg-[#11151c] sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="text-xs font-black tracking-[0.14em] text-[#ed6d46]">摄影实验成片</div><h2 className="mt-2 text-2xl font-black text-[#17243c]">{filmPreset.name} 成片</h2><p className="mt-1 text-sm text-pastel-muted">{camera.name} · {lens.name} · {completedCount} 张完成{failedCount ? ` · ${failedCount} 张失败` : ''}</p></div><button type="button" onClick={resetOutput} className="min-h-11 rounded-xl border border-pastel-border px-4 text-sm font-bold hover:bg-pastel-bg">调整参数重新生成</button></div><div className="mt-6 grid grid-cols-1 gap-5 2xl:grid-cols-2">{activeRecord.results.map((result, index) => { const source = activeRecord.images.find((image) => image.id === result.sourceId); if (!source) return null; return <article key={result.id} className="overflow-hidden rounded-2xl border border-pastel-border bg-pastel-bg/50"><div className="grid grid-cols-2 gap-px bg-[#d8e3ee]"><button type="button" onClick={() => setSelectedPreview(source.preview)} className="relative aspect-[2/3] bg-[#eef5ff]"><img src={source.preview} alt={`原片 ${index + 1}`} className="h-full w-full object-cover" /><span className="absolute left-2 top-2 rounded-full bg-[#17243c]/85 px-2.5 py-1 text-xs font-bold text-white">原片</span></button><button type="button" disabled={!result.imageUrl} onClick={() => result.imageUrl && setSelectedPreview(result.imageUrl)} className="relative aspect-[2/3] bg-[#eef5ff]">{result.imageUrl ? <img src={result.imageUrl} alt={`${filmPreset.name} 成片 ${index + 1}`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center p-4 text-center text-sm text-red-500">{result.error || '生成失败'}</div>}<span className="absolute left-2 top-2 rounded-full bg-[#ed6d46] px-2.5 py-1 text-xs font-bold text-white">{filmPreset.name}</span></button></div><div className="flex min-h-16 items-center justify-between gap-3 px-4 py-2"><div><strong className="block text-sm">成片 {String(index + 1).padStart(2, '0')}</strong><span className="text-xs text-pastel-muted">{source.name}</span></div><div className="flex gap-1">{result.imageUrl ? <button type="button" onClick={() => setSelectedPreview(result.imageUrl!)} className="flex h-11 w-11 items-center justify-center rounded-lg text-pastel-muted hover:bg-white hover:text-[#2d6bb1]" aria-label="放大预览"><Maximize2 className="h-4 w-4" /></button> : null}{result.imageUrl ? <button type="button" onClick={() => void downloadImageFile(result.imageUrl!, `${filmPreset.id}-${String(index + 1).padStart(2, '0')}.png`)} className="flex h-11 w-11 items-center justify-center rounded-lg text-pastel-muted hover:bg-emerald-50 hover:text-emerald-600" aria-label="下载"><Download className="h-4 w-4" /></button> : null}</div></div></article>; })}</div><button type="button" onClick={startNewRecord} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-pastel-border bg-pastel-bg text-sm font-black hover:border-[#ed6d46] hover:text-[#ed6d46]"><Plus className="h-4 w-4" />新开摄影实验任务</button></section> : null}
          </div>
        </div>
      </div>

      {isRatioModalOpen ? (
        <RatioSelectionModal
          value={activeRecord.aspectRatio}
          onClose={() => setIsRatioModalOpen(false)}
          onSelect={(aspectRatio) => {
            updateActive((record) => ({ ...record, aspectRatio, results: [], colorAnchor: '', error: '', phase: 'idle' }));
            setIsRatioModalOpen(false);
          }}
        />
      ) : null}
      {selectedPreview ? <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 p-4" onClick={() => setSelectedPreview(null)}><button type="button" onClick={() => setSelectedPreview(null)} className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white" aria-label="关闭预览"><X className="h-6 w-6" /></button><img src={selectedPreview} alt="摄影实验大图预览" className="max-h-[88vh] max-w-full rounded-xl object-contain" /></div> : null}
    </div>
  );
};

export default PhotographyLabTab;
