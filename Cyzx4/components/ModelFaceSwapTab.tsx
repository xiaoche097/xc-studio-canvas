import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Image as ImageIcon,
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
  UserCircle2,
  UserCheck,
  Wand2,
  WandSparkles,
  X,
} from 'lucide-react';
import { AspectRatio, ImageResolution } from '../types';
import { compressImage, generateImageToImage } from '../services/geminiService';
import { useImagePaste } from '../hooks/useImagePaste';
import { useCancelableGeneration } from '../hooks/useCancelableGeneration';
import { getErrorMessage, isAbortError } from '../utils/apiHelpers';
import { saveGeneratedProject } from '../../services/projectHistoryService';
import { ModelLibraryModal } from './ModelLibraryModal';
import { modelLibrary, ModelItem } from '../services/modelLibrary';

export interface FaceSwapUploadedImage {
  id: string;
  name: string;
  mime: string;
  base64: string;
  preview: string;
}

export type FaceSwapStatus = 'pending' | 'submitting' | 'processing' | 'done' | 'error' | 'cancelled';

export interface FaceSwapResult {
  id: string;
  sourceImageId: string;
  sourceImageName: string;
  status: FaceSwapStatus;
  prompt: string;
  imageUrl?: string;
  error?: string;
}

export interface FaceSwapRecord {
  id: string;
  createdAt: number;
  step: 'config' | 'generating' | 'complete';
  targetModelImages: FaceSwapUploadedImage[];
  referenceFaceImage: FaceSwapUploadedImage | null;
  referenceSceneImage: FaceSwapUploadedImage | null;
  selectedModelPersonaId: string | null;
  userPrompt: string;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
  results: FaceSwapResult[];
  error: string;
}

const MAX_TARGET_IMAGES = 15;
const MAX_FILE_SIZE = 30 * 1024 * 1024;
const DEFAULT_MODEL_ID = 'gemini-3.1-flash-image-preview';

const isValidImageType = (file: File) => {
  if (!file) return false;
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  const validExts = ['.jpg', '.jpeg', '.png', '.webp', '.jfif', '.heic', '.avif', '.bmp'];
  return type.startsWith('image/') || validExts.some((ext) => name.endsWith(ext));
};

const createRecord = (): FaceSwapRecord => ({
  id: crypto.randomUUID(),
  createdAt: Date.now(),
  step: 'config',
  targetModelImages: [],
  referenceFaceImage: null,
  referenceSceneImage: null,
  selectedModelPersonaId: null,
  userPrompt: '',
  aspectRatio: AspectRatio.PORTRAIT_2_3,
  resolution: ImageResolution.RES_2K,
  results: [],
  error: '',
});

const FACE_SWAP_RATIO_OPTIONS: Array<{
  id: AspectRatio;
  label: string;
  subLabel: string;
  iconWidth: string;
  iconHeight: string;
}> = [
  {
    id: AspectRatio.PORTRAIT_2_3,
    label: '2:3 竖版',
    subLabel: '经典单反人像与电商主图',
    iconWidth: 'w-8',
    iconHeight: 'h-12',
  },
  {
    id: AspectRatio.PORTRAIT_3_4,
    label: '3:4 竖版',
    subLabel: '时尚服装与详情页展示',
    iconWidth: 'w-8',
    iconHeight: 'h-11',
  },
  {
    id: AspectRatio.SQUARE,
    label: '1:1 方版',
    subLabel: '经典正方形排版',
    iconWidth: 'w-10',
    iconHeight: 'h-10',
  },
  {
    id: AspectRatio.PORTRAIT_9_16,
    label: '9:16 竖屏',
    subLabel: '手机全屏展示与短视频',
    iconWidth: 'w-6',
    iconHeight: 'h-12.5',
  },
  {
    id: AspectRatio.LANDSCAPE_16_9,
    label: '16:9 横版',
    subLabel: '画册长图与横屏展示',
    iconWidth: 'w-13',
    iconHeight: 'h-7',
  },
];

export const ModelFaceSwapTab: React.FC<{ isActive?: boolean }> = ({ isActive = true }) => {
  const initialRecordRef = useRef<FaceSwapRecord | null>(null);
  if (!initialRecordRef.current) initialRecordRef.current = createRecord();

  const [records, setRecords] = useState<FaceSwapRecord[]>([initialRecordRef.current]);
  const [activeRecordId, setActiveRecordId] = useState(initialRecordRef.current.id);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [isRatioModalOpen, setIsRatioModalOpen] = useState(false);
  const [modelPersonas, setModelPersonas] = useState<ModelItem[]>([]);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);

  const targetInputRef = useRef<HTMLInputElement>(null);
  const refFaceInputRef = useRef<HTMLInputElement>(null);
  const refSceneInputRef = useRef<HTMLInputElement>(null);

  const [activeUploadKind, setActiveUploadKind] = useState<'target' | 'refFace' | 'refScene'>('target');
  const activeUploadKindRef = useRef<'target' | 'refFace' | 'refScene'>('target');

  const [isDraggingTarget, setIsDraggingTarget] = useState(false);
  const [isDraggingRefFace, setIsDraggingRefFace] = useState(false);
  const [isDraggingRefScene, setIsDraggingRefScene] = useState(false);

  const activateUploadKind = useCallback((kind: 'target' | 'refFace' | 'refScene') => {
    activeUploadKindRef.current = kind;
    setActiveUploadKind(kind);
  }, []);

  useEffect(() => {
    modelLibrary.list().then(setModelPersonas).catch(() => {});
  }, []);

  const handleCreateModelPersona = async (name: string, file: File) => {
    const compressed = await compressImage(file, 2048, 0.92);
    const model: ModelItem = {
      id: crypto.randomUUID(),
      name,
      preview: `data:${compressed.mime};base64,${compressed.base64}`,
      base64: compressed.base64,
      mime: compressed.mime,
      prompt: `High-Precision Model Reference: reproduce exact face contour, eyes, nose, lips, hair, and facial type matching ${name}.`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await modelLibrary.save(model);
    setModelPersonas((prev) => [model, ...prev]);
    patchActive({ selectedModelPersonaId: model.id });
  };

  const handleRenameModelPersona = async (model: ModelItem, newName: string) => {
    const next = { ...model, name: newName, updatedAt: Date.now() };
    await modelLibrary.save(next);
    setModelPersonas((prev) => prev.map((m) => (m.id === model.id ? next : m)));
  };

  const handleDeleteModelPersona = async (id: string) => {
    await modelLibrary.remove(id);
    setModelPersonas((prev) => prev.filter((m) => m.id !== id));
    if (activeRecord.selectedModelPersonaId === id) {
      patchActive({ selectedModelPersonaId: null });
    }
  };

  const {
    cancelMessage,
    startGenerationTask,
    cancelGenerationTask,
    assertCurrentGenerationTask,
    finishGenerationTask,
  } = useCancelableGeneration();

  const activeRecord = useMemo(
    () => records.find((record) => record.id === activeRecordId) || records[0],
    [records, activeRecordId],
  );

  const patchActive = useCallback((patch: Partial<FaceSwapRecord>) => {
    setRecords((prev) =>
      prev.map((record) => (record.id === activeRecordId ? { ...record, ...patch } : record)),
    );
  }, [activeRecordId]);

  const patchRecordResults = useCallback((recordId: string, results: FaceSwapResult[]) => {
    setRecords((prev) =>
      prev.map((record) => (record.id === recordId ? { ...record, results } : record)),
    );
  }, []);

  const updateResultStatus = useCallback(
    (recordId: string, resultId: string, patch: Partial<FaceSwapResult>) => {
      setRecords((prev) =>
        prev.map((record) => {
          if (record.id !== recordId) return record;
          return {
            ...record,
            results: record.results.map((res) => (res.id === resultId ? { ...res, ...patch } : res)),
          };
        }),
      );
    },
    [],
  );

  const createNewTask = useCallback(() => {
    const next = createRecord();
    setRecords((prev) => [next, ...prev]);
    setActiveRecordId(next.id);
  }, []);

  const deleteTask = useCallback((taskRecordId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecords((prev) => {
      const next = prev.filter((r) => r.id !== taskRecordId);
      if (!next.length) {
        const fresh = createRecord();
        setActiveRecordId(fresh.id);
        return [fresh];
      }
      if (taskRecordId === activeRecordId) {
        setActiveRecordId(next[0].id);
      }
      return next;
    });
  }, [activeRecordId]);

  const selectedModelPersona = useMemo(() => {
    if (!activeRecord?.selectedModelPersonaId) return null;
    return modelPersonas.find((m) => m.id === activeRecord.selectedModelPersonaId) || null;
  }, [activeRecord?.selectedModelPersonaId, modelPersonas]);

  // Image Upload Helper
  const processUploadedFiles = async (files: File[], kind: 'target' | 'refFace' | 'refScene') => {
    const imageFiles = files.filter(isValidImageType);
    if (!imageFiles.length) return;

    if (kind === 'target') {
      const currentCount = activeRecord.targetModelImages.length;
      const accepted = imageFiles
        .filter((file) => file.size <= MAX_FILE_SIZE)
        .slice(0, Math.max(0, MAX_TARGET_IMAGES - currentCount));

      const uploaded = await Promise.all(
        accepted.map(async (file): Promise<FaceSwapUploadedImage> => {
          const compressed = await compressImage(file, 2048, 0.92);
          return {
            id: crypto.randomUUID(),
            name: file.name,
            mime: compressed.mime,
            base64: compressed.base64,
            preview: `data:${compressed.mime};base64,${compressed.base64}`,
          };
        }),
      );

      patchActive({
        targetModelImages: [...activeRecord.targetModelImages, ...uploaded],
        error: '',
      });
    } else if (kind === 'refFace') {
      const file = imageFiles[0];
      if (file.size > MAX_FILE_SIZE) return;
      const compressed = await compressImage(file, 2048, 0.92);
      const uploaded: FaceSwapUploadedImage = {
        id: crypto.randomUUID(),
        name: file.name,
        mime: compressed.mime,
        base64: compressed.base64,
        preview: `data:${compressed.mime};base64,${compressed.base64}`,
      };
      patchActive({ referenceFaceImage: uploaded, error: '' });
    } else if (kind === 'refScene') {
      const file = imageFiles[0];
      if (file.size > MAX_FILE_SIZE) return;
      const compressed = await compressImage(file, 2048, 0.92);
      const uploaded: FaceSwapUploadedImage = {
        id: crypto.randomUUID(),
        name: file.name,
        mime: compressed.mime,
        base64: compressed.base64,
        preview: `data:${compressed.mime};base64,${compressed.base64}`,
      };
      patchActive({ referenceSceneImage: uploaded, error: '' });
    }
  };

  const handlePasteImages = useCallback(
    async (files: File[]) => {
      await processUploadedFiles(files, activeUploadKindRef.current);
    },
    [activeRecord],
  );

  useImagePaste((files) => {
    void handlePasteImages(files);
  }, isActive);

  // Face Swap Generation Pipeline
  const runGeneration = async () => {
    if (!activeRecord.targetModelImages.length) {
      patchActive({ error: '请至少上传 1 张需要换脸的带模特图。' });
      return;
    }
    if (!activeRecord.referenceFaceImage && !selectedModelPersona) {
      patchActive({ error: '请上传 1 张参考人脸图片或在模特库中选择固定模特。' });
      return;
    }

    const taskRecordId = activeRecord.id;
    const { taskId, signal } = startGenerationTask();
    patchActive({ step: 'generating', error: '' });

    const initialResults: FaceSwapResult[] = activeRecord.targetModelImages.map((img) => ({
      id: crypto.randomUUID(),
      sourceImageId: img.id,
      sourceImageName: img.name,
      status: 'pending',
      prompt: '',
    }));

    patchRecordResults(taskRecordId, initialResults);

    let completedCount = 0;

    for (let i = 0; i < activeRecord.targetModelImages.length; i++) {
      const targetImg = activeRecord.targetModelImages[i];
      const resultObj = initialResults[i];

      try {
        assertCurrentGenerationTask(taskId, signal);
        updateResultStatus(taskRecordId, resultObj.id, { status: 'processing' });

        const inputImages: Array<{ base64: string; mimeType: string }> = [
          { base64: targetImg.base64, mimeType: targetImg.mime },
        ];

        let refFacePromptNote = '';
        if (activeRecord.referenceFaceImage) {
          inputImages.push({
            base64: activeRecord.referenceFaceImage.base64,
            mimeType: activeRecord.referenceFaceImage.mime,
          });
          refFacePromptNote = `Image 2 contains the EXACT REFERENCE FACE. Seamlessly swap the facial features, eyes, nose, mouth, skin tone, and face shape of the model in Image 1 with the reference face from Image 2.`;
        } else if (selectedModelPersona) {
          inputImages.push({
            base64: selectedModelPersona.base64,
            mimeType: selectedModelPersona.mime,
          });
          refFacePromptNote = `Image 2 contains the target model persona (${selectedModelPersona.name}). Seamlessly replace the face of the model in Image 1 with this exact model's facial structure and identity.`;
        }

        let refScenePromptNote = '';
        if (activeRecord.referenceSceneImage) {
          inputImages.push({
            base64: activeRecord.referenceSceneImage.base64,
            mimeType: activeRecord.referenceSceneImage.mime,
          });
          refScenePromptNote = `Image 3 is a REFERENCE SCENE. Align the lighting, shadow direction, color grading, and background atmosphere to match Image 3 while keeping the product and pose intact.`;
        }

        const faceSwapPrompt = `
You are a high-precision commercial AI Face Swap & Fashion Refinement Model.

CORE TASK:
- Image 1: Target Model & Apparel Photo (Keep body pose, clothing structure, fabric textures, background and composition 100% intact).
${refFacePromptNote}
${refScenePromptNote}

RULES:
1. FACE SWAP ACCURACY: Replace ONLY the facial features of the model in Image 1 with the target reference face in Image 2.
2. CONSISTENCY LOCK: Keep the original hairstyle (unless specified otherwise), skin tone blending, body posture, clothing folds, and lighting natural and photo-realistic.
3. USER CUSTOMIZATION: ${activeRecord.userPrompt.trim() || 'Keep original hairstyle and clothing, only swap facial identity.'}
4. NO DISTORTION: Ensure natural edges around neck, hair border, and forehead. Output high resolution without artifacts or text overlays.
5. CANVAS ASPECT RATIO: ${activeRecord.aspectRatio}.
`.trim();

        updateResultStatus(taskRecordId, resultObj.id, { prompt: faceSwapPrompt });

        const [rawImage] = await generateImageToImage(inputImages, faceSwapPrompt, {
          aspectRatio: activeRecord.aspectRatio,
          resolution: activeRecord.resolution,
          modelId: DEFAULT_MODEL_ID,
          signal,
        });

        assertCurrentGenerationTask(taskId, signal);

        if (!rawImage) throw new Error('模型未返回生成结果图片');

        const imageUrl = rawImage.startsWith('data:') ? rawImage : `data:image/png;base64,${rawImage}`;

        updateResultStatus(taskRecordId, resultObj.id, {
          status: 'done',
          imageUrl,
        });

        completedCount++;

        await saveGeneratedProject({
          type: 'MODEL',
          generated: [imageUrl],
          original: inputImages.map((img) => `data:${img.mimeType};base64,${img.base64}`),
          prompt: faceSwapPrompt,
          params: {
            subType: 'model_face_swap',
            title: `模特换脸 - ${targetImg.name}`,
            aspectRatio: activeRecord.aspectRatio,
            resolution: activeRecord.resolution,
          },
        });
      } catch (err: any) {
        if (isAbortError(err)) {
          updateResultStatus(taskRecordId, resultObj.id, {
            status: 'cancelled',
            error: cancelMessage || '任务已取消',
          });
          break;
        } else {
          updateResultStatus(taskRecordId, resultObj.id, {
            status: 'error',
            error: getErrorMessage(err),
          });
        }
      }
    }

    finishGenerationTask(taskId);
    patchActive({ step: completedCount > 0 ? 'complete' : 'config' });
  };

  const isGenerating = activeRecord.step === 'generating';

  // History Panel Component (Matches Image 2 & Scene Generation Tab 1:1)
  const historyPanel = (
    <section className="flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-[#d9e5f1] bg-white p-4 shadow-[0_10px_30px_rgba(33,66,104,0.06)] dark:border-white/10 dark:bg-[#11151c]">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-black text-[#142139] dark:text-white">生成记录</h2>
          <p className="mt-0.5 text-xs text-[#718198]">可同时开多个换脸任务</p>
        </div>
        <button
          type="button"
          onClick={() => setIsHistoryOpen(false)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:bg-white/10 dark:text-white"
          title="收起生成记录"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </header>

      <button
        type="button"
        onClick={createNewTask}
        className="mb-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#17243c] text-xs font-black text-white shadow-sm transition hover:bg-[#253654] dark:bg-white dark:text-[#17243c]"
      >
        <Plus className="h-4 w-4" /> 新开任务
      </button>

      <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto pr-1">
        {records.map((rec) => {
          const isSelected = rec.id === activeRecord.id;
          const thumbnail = rec.results.find((r) => r.imageUrl)?.imageUrl || rec.targetModelImages[0]?.preview;

          return (
            <article
              key={rec.id}
              onClick={() => setActiveRecordId(rec.id)}
              className={`group relative cursor-pointer overflow-hidden rounded-2xl border-2 transition ${
                isSelected
                  ? 'border-[#ed6d46] bg-white shadow-md ring-1 ring-[#ed6d46]'
                  : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-white/5'
              }`}
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                {thumbnail ? (
                  <img src={thumbnail} alt="缩略图" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-300">
                    <UserCheck className="h-10 w-10 stroke-[1.5]" />
                  </div>
                )}

                {/* Delete Task Button (Shows on card hover or tap) */}
                <button
                  type="button"
                  onClick={(e) => deleteTask(rec.id, e)}
                  className="absolute top-2 right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100 hover:bg-red-600"
                  title="删除任务"
                  aria-label="删除任务"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>

                {/* Dark Status Bar across the bottom of preview (Matches Image 2) */}
                <div className="absolute inset-x-0 bottom-0 bg-[#17243c]/90 py-1.5 text-center text-xs font-bold text-white backdrop-blur-xs">
                  {rec.step === 'complete'
                    ? '已完成'
                    : rec.step === 'generating'
                    ? '生成中'
                    : '编辑中'}
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5">
                <span className="block text-[0.7rem] font-bold text-[#718198]">
                  {new Date(rec.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <button
                  type="button"
                  onClick={(e) => deleteTask(rec.id, e)}
                  className="rounded p-1 text-slate-400 opacity-60 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/40"
                  title="删除任务"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );

  return (
    <div className="h-full overflow-y-auto bg-[#eef6ff] text-[#17243c] dark:bg-[#080a0d] dark:text-white">
      <div className="mx-auto w-full max-w-[105rem] px-3 py-5 sm:px-5 lg:px-8">
        {/* Floating Header Banner (Matches Image 1 & Scene Generation) */}
        <header className="relative mb-5 overflow-hidden rounded-[1.75rem] border border-[#d9e5f1] bg-white px-4 py-6 shadow-[0_14px_45px_rgba(33,66,104,0.07)] dark:border-white/10 dark:bg-[#11151c] sm:px-7 sm:py-7">
          <div className="absolute -right-16 -top-24 h-56 w-56 rounded-full border-[2rem] border-[#edf5fd] bg-[#fff2e9] dark:border-white/[0.03] dark:bg-[#ed6d46]/5" />
          <div className="relative text-center">
            <div className="inline-flex items-center gap-2 text-xs font-black tracking-[0.14em] text-[#6f8199]">
              <Sparkles className="h-4 w-4 text-[#ed6d46]" /> AI 服装视觉 Agent
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-[#142139] dark:text-white sm:text-3xl">
              模特换脸
            </h1>
            <p className="mx-auto mt-2 max-w-3xl text-sm leading-6 text-[#718198]">
              上传带模特图（最多 15 张）与参考人脸，一键批量换脸。保持原图动作、服装版型与场景光影自然一致。
            </p>

            {/* Workflow Step Badges */}
            <div className="mt-4 flex items-center justify-center gap-2">
              <span
                className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-black transition ${
                  activeRecord.step === 'config'
                    ? 'bg-[#17243c] text-white dark:bg-white dark:text-[#17243c]'
                    : 'bg-[#eef4fc] text-[#718198] dark:bg-white/5'
                }`}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[0.68rem] font-black text-[#17243c]">
                  1
                </span>
                1. 填写配置
              </span>
              <span className="text-slate-300">——</span>
              <span
                className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-black transition ${
                  activeRecord.step === 'generating'
                    ? 'bg-[#ed6d46] text-white'
                    : 'bg-[#eef4fc] text-[#718198] dark:bg-white/5'
                }`}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[0.68rem] font-black text-[#17243c]">
                  2
                </span>
                2. 生成中
              </span>
              <span className="text-slate-300">——</span>
              <span
                className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-black transition ${
                  activeRecord.step === 'complete'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#eef4fc] text-[#718198] dark:bg-white/5'
                }`}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[0.68rem] font-black text-[#17243c]">
                  3
                </span>
                3. 完成
              </span>
            </div>
          </div>
        </header>

        {/* Floating Left-Bottom Collapsed Record Button (Matches Image 3) */}
        {!isHistoryOpen && (
          <button
            type="button"
            onClick={() => setIsHistoryOpen(true)}
            className="fixed bottom-5 left-4 z-40 flex min-h-12 items-center gap-2 rounded-full border border-[#d9e5f1] bg-white px-4 text-sm font-black shadow-[0_8px_24px_rgba(30,50,80,0.16)] transition hover:scale-105 dark:border-white/10 dark:bg-[#15191f] md:left-[16.25rem] lg:left-[17rem]"
          >
            <PanelLeftOpen className="h-4 w-4 text-[#ed6d46]" />
            生成记录
            <span className="rounded-full bg-[#f0f4f9] px-2 py-1 text-xs text-[#718198] dark:bg-white/10">
              {records.length}
            </span>
          </button>
        )}
        {isHistoryOpen && (
          <button
            type="button"
            className="fixed inset-0 z-[69] bg-[#10203a]/35 xl:hidden"
            onClick={() => setIsHistoryOpen(false)}
            aria-label="关闭生成记录"
          />
        )}

        {/* Main 3-Column Grid Layout */}
        <div
          className={`grid grid-cols-1 gap-5 ${
            isHistoryOpen
              ? 'xl:grid-cols-[17rem_minmax(23rem,31rem)_minmax(0,1fr)]'
              : 'xl:grid-cols-[minmax(23rem,31rem)_minmax(0,1fr)]'
          }`}
        >
          {/* History Panel (Shown when open) */}
          {isHistoryOpen && (
            <div className="fixed inset-y-3 left-3 z-[70] w-[min(18rem,calc(100vw-1.5rem))] xl:sticky xl:top-4 xl:z-10 xl:h-[calc(100vh-7rem)] xl:w-auto xl:self-start">
              {historyPanel}
            </div>
          )}

          {/* Center Configuration Panel */}
          <div className="flex flex-col gap-5">
            {/* 01 带模特图 Card */}
            <section
              onMouseEnter={() => activateUploadKind('target')}
              className={`rounded-[1.5rem] border bg-white p-5 shadow-sm transition-all duration-200 dark:bg-[#11151c] ${
                activeUploadKind === 'target'
                  ? 'border-[#ed6d46] ring-1 ring-[#ed6d46]/30 dark:border-[#ed6d46]'
                  : 'border-[#d9e5f1] dark:border-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#17243c] text-xs font-black text-white dark:bg-white dark:text-[#17243c]">
                    01
                  </span>
                  <h3 className="text-sm font-black">带模特图</h3>
                  {activeUploadKind === 'target' && (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[0.62rem] font-bold text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                      当前粘贴目标
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold text-[#718198]">
                  {activeRecord.targetModelImages.length} / {MAX_TARGET_IMAGES} 张
                </span>
              </div>
              <p className="mt-1 text-xs text-[#718198]">
                上传需要换脸的模特照片，数量与生成结果一一对应，最多 {MAX_TARGET_IMAGES} 张
              </p>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingTarget(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDraggingTarget(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingTarget(false);
                  if (e.dataTransfer.files?.length) {
                    activateUploadKind('target');
                    processUploadedFiles(Array.from(e.dataTransfer.files), 'target');
                  }
                }}
                onClick={() => activateUploadKind('target')}
                className={`mt-4 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 text-center transition ${
                  isDraggingTarget
                    ? 'border-[#ed6d46] bg-[#fff0e8] dark:bg-[#ed6d46]/20'
                    : 'border-[#f48c68] bg-[#fff8f3] hover:border-[#ed6d46] dark:border-white/20 dark:bg-white/5'
                }`}
              >
                {activeRecord.targetModelImages.length > 0 ? (
                  <div className="w-full">
                    {/* Thumbnails + Add Plus Tile Row (Matches Screenshot) */}
                    <div className="custom-scrollbar flex items-center justify-center gap-3 overflow-x-auto p-1">
                      {activeRecord.targetModelImages.map((img, idx) => (
                        <div
                          key={img.id}
                          className="group relative h-36 w-28 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-white/10 dark:bg-slate-800"
                        >
                          <img
                            src={img.preview}
                            alt={img.name}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPreview(img.preview);
                            }}
                            className="h-full w-full cursor-pointer object-cover transition group-hover:scale-105"
                            title="点击预览大图"
                          />
                          <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 py-0.5 text-[0.6rem] font-bold text-white">
                            #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              patchActive({
                                targetModelImages: activeRecord.targetModelImages.filter((i) => i.id !== img.id),
                              });
                            }}
                            className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100 hover:bg-red-600"
                            title="删除此图"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}

                      {/* Add Plus Tile (Matches Screenshot) */}
                      {activeRecord.targetModelImages.length < MAX_TARGET_IMAGES && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            activateUploadKind('target');
                            targetInputRef.current?.click();
                          }}
                          className="flex h-36 w-28 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#b9c9dc] bg-white text-[#718198] transition hover:border-[#ed6d46] hover:text-[#ed6d46] dark:border-white/20 dark:bg-white/5"
                          title="点击追加更多带模特图"
                        >
                          <Plus className="h-7 w-7" />
                        </button>
                      )}
                    </div>

                    <p className="mt-3 text-xs font-medium text-[#718198]">
                      点击预览大图 · 支持拖拽和复制粘贴
                    </p>
                  </div>
                ) : (
                  <>
                    <UserCheck className="h-9 w-9 text-[#ed6d46]" />
                    <span className="mt-2 text-xs font-black">带模特图</span>
                    <span className="mt-1 text-[0.68rem] text-[#718198]">
                      JPG / PNG / WEBP · 单张不超过 30MB · 支持拖拽和剪贴板粘贴
                    </span>

                    <div className="mt-4 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          activateUploadKind('target');
                          targetInputRef.current?.click();
                        }}
                        className="flex items-center gap-1.5 rounded-xl bg-[#ed6d46] px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-[#d8552e]"
                      >
                        <Upload className="h-3.5 w-3.5" /> 本地上传
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          alert('预设资产库已就绪');
                        }}
                        className="flex items-center gap-1.5 rounded-xl border border-[#cbd5e1] bg-white px-4 py-2 text-xs font-black text-[#17243c] hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:text-white"
                      >
                        <ImageIcon className="h-3.5 w-3.5 text-[#718198]" /> 从资产选择
                      </button>
                    </div>
                  </>
                )}

                <input
                  ref={targetInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) {
                      processUploadedFiles(Array.from(e.target.files), 'target');
                      e.target.value = '';
                    }
                  }}
                />
              </div>

              <p className="mt-3 text-[0.68rem] leading-4 text-[#94a3b8]">
                请确保目标模特图已获得合法使用授权，尤其是用于商品展示、广告投放或商业宣传时。
              </p>
            </section>

            {/* 02 参考人脸 Card */}
            <section
              onMouseEnter={() => activateUploadKind('refFace')}
              className={`rounded-[1.5rem] border bg-white p-5 shadow-sm transition-all duration-200 dark:bg-[#11151c] ${
                activeUploadKind === 'refFace'
                  ? 'border-[#ed6d46] ring-1 ring-[#ed6d46]/30 dark:border-[#ed6d46]'
                  : 'border-[#d9e5f1] dark:border-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#17243c] text-xs font-black text-white dark:bg-white dark:text-[#17243c]">
                    02
                  </span>
                  <h3 className="text-sm font-black">参考人脸</h3>
                  {activeUploadKind === 'refFace' && (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[0.62rem] font-bold text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                      当前粘贴目标
                    </span>
                  )}
                </div>
                {activeRecord.referenceFaceImage && (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[0.65rem] font-black text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    已选就绪
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-[#718198]">
                上传 1 张清晰正面脸参考图，将应用到全部带模特图
              </p>

              {activeRecord.referenceFaceImage ? (
                <div className="relative mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                  <img
                    src={activeRecord.referenceFaceImage.preview}
                    alt="参考人脸"
                    className="h-16 w-16 rounded-xl object-cover shadow-sm"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-black">{activeRecord.referenceFaceImage.name}</span>
                    <span className="mt-1 block text-[0.68rem] text-[#718198]">高清正面人脸已锁定</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => patchActive({ referenceFaceImage: null })}
                    className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-red-600 dark:hover:bg-white/10"
                  >
                    <Trash2 className="h-4.5 w-4.5" />
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingRefFace(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDraggingRefFace(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingRefFace(false);
                    if (e.dataTransfer.files?.length) {
                      activateUploadKind('refFace');
                      processUploadedFiles(Array.from(e.dataTransfer.files), 'refFace');
                    }
                  }}
                  onClick={() => activateUploadKind('refFace')}
                  className={`mt-4 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-center transition ${
                    isDraggingRefFace
                      ? 'border-[#ed6d46] bg-[#fff0e8] dark:bg-[#ed6d46]/20'
                      : 'border-[#f48c68] bg-[#fff8f3] hover:border-[#ed6d46] dark:border-white/20 dark:bg-white/5'
                  }`}
                >
                  <UserCircle2 className="h-9 w-9 text-[#ed6d46]" />
                  <span className="mt-2 text-xs font-black">参考人脸</span>
                  <span className="mt-1 text-[0.68rem] text-[#718198]">
                    JPG / PNG / WEBP · 单张不超过 30MB · 支持拖拽和复制粘贴
                  </span>

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        activateUploadKind('refFace');
                        refFaceInputRef.current?.click();
                      }}
                      className="flex items-center gap-1.5 rounded-xl bg-[#ed6d46] px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-[#d8552e]"
                    >
                      <Upload className="h-3.5 w-3.5" /> 本地上传
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsModelModalOpen(true);
                      }}
                      className="flex items-center gap-1.5 rounded-xl border border-[#cbd5e1] bg-white px-4 py-2 text-xs font-black text-[#17243c] hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:text-white"
                    >
                      <ImageIcon className="h-3.5 w-3.5 text-[#718198]" /> 从资产选择
                    </button>
                  </div>
                  <input
                    ref={refFaceInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) {
                        processUploadedFiles(Array.from(e.target.files), 'refFace');
                        e.target.value = '';
                      }
                    }}
                  />
                </div>
              )}

              <div className="mt-3 rounded-xl bg-[#f0f4f9] p-3 text-[0.68rem] leading-4 text-[#718198] dark:bg-white/5">
                请上传本人或已获得授权的人脸照片。禁止上传未经授权的照片、公众人物照片、未成年人照片。建议使用正面、光线均匀的照片作为参考。
              </div>
            </section>

            {/* 模特库 (可选) Card */}
            <section className="rounded-[1.5rem] border border-[#d9e5f1] bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#11151c]">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#eef4fc] text-[#ed6d46] dark:bg-white/10">
                  <UserCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black">模特库 (可选)</h3>
                  <p className="text-[0.68rem] text-[#718198]">
                    固定模特面部与人体参考，保持高精度一致性生成
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setIsModelModalOpen(true)}
                  className="flex min-h-12 w-full items-center justify-between rounded-2xl border border-[#d9e5f1] bg-[#f8fbff] px-4 py-3 text-left transition hover:border-[#ed6d46] dark:border-white/10 dark:bg-white/5"
                >
                  <div>
                    <span className="block text-xs font-black text-[#17243c] dark:text-white">
                      {selectedModelPersona ? `固定模特：${selectedModelPersona.name}` : '选择/管理固定模特...'}
                    </span>
                    <span className="mt-0.5 block text-[0.68rem] text-[#718198]">
                      {selectedModelPersona
                        ? '已锁定面部与身形标准'
                        : '包含官方固定模特，亦可上传自定义模特'}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#718198]" />
                </button>
              </div>
            </section>

            {/* 参考场景图 (可选) Card */}
            <section
              onMouseEnter={() => activateUploadKind('refScene')}
              className={`rounded-[1.5rem] border bg-white p-5 shadow-sm transition-all duration-200 dark:bg-[#11151c] ${
                activeUploadKind === 'refScene'
                  ? 'border-[#ed6d46] ring-1 ring-[#ed6d46]/30 dark:border-[#ed6d46]'
                  : 'border-[#d9e5f1] dark:border-white/10'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#fff0e8] text-[#ed6d46] dark:bg-white/10">
                  <ImageIcon className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black">参考场景图 (可选)</h3>
                    {activeUploadKind === 'refScene' && (
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[0.62rem] font-bold text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                        当前粘贴目标
                      </span>
                    )}
                  </div>
                  <p className="text-[0.68rem] text-[#718198]">
                    自动分析并同步构图、姿势动作与光影方案
                  </p>
                </div>
              </div>

              {activeRecord.referenceSceneImage ? (
                <div className="relative mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                  <img
                    src={activeRecord.referenceSceneImage.preview}
                    alt="参考场景"
                    className="h-16 w-16 rounded-xl object-cover shadow-sm"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-black">{activeRecord.referenceSceneImage.name}</span>
                    <span className="mt-1 block text-[0.68rem] text-[#718198]">场景光影与姿势迁移已锁定</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => patchActive({ referenceSceneImage: null })}
                    className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-red-600 dark:hover:bg-white/10"
                  >
                    <Trash2 className="h-4.5 w-4.5" />
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingRefScene(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDraggingRefScene(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingRefScene(false);
                    if (e.dataTransfer.files?.length) {
                      activateUploadKind('refScene');
                      processUploadedFiles(Array.from(e.dataTransfer.files), 'refScene');
                    }
                  }}
                  onClick={() => activateUploadKind('refScene')}
                  className={`mt-4 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-center transition ${
                    isDraggingRefScene
                      ? 'border-[#ed6d46] bg-[#fff8f3] dark:bg-[#ed6d46]/10'
                      : 'border-[#cbd5e1] bg-[#f8fafc] hover:border-[#ed6d46] dark:border-white/15 dark:bg-white/5'
                  }`}
                >
                  <Wand2 className="h-8 w-8 text-[#ed6d46]" />
                  <span className="mt-2 text-xs font-black">拖拽、点击或Ctrl+V粘贴参考图</span>
                  <span className="mt-1 text-[0.68rem] text-[#718198]">
                    JPG / JPEG / PNG / WEBP · 单张≤30MB · 自动分析构图与光影
                  </span>
                  <input
                    ref={refSceneInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) {
                        processUploadedFiles(Array.from(e.target.files), 'refScene');
                        e.target.value = '';
                      }
                    }}
                  />
                </div>
              )}
            </section>

            {/* 补充说明 (选填) Card */}
            <section className="rounded-[1.5rem] border border-[#d9e5f1] bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#11151c]">
              <h3 className="text-sm font-black">补充说明 (选填)</h3>
              <p className="mt-0.5 text-xs text-[#718198]">进一步描述换脸期望，如保留发型、妆容风格等</p>
              <textarea
                value={activeRecord.userPrompt}
                onChange={(e) => patchActive({ userPrompt: e.target.value })}
                placeholder="例如：保留原图发型与服装，仅替换面部..."
                rows={3}
                className="mt-3 w-full rounded-2xl border border-[#cbd5e1] p-3.5 text-xs focus:border-[#ed6d46] focus:outline-none dark:border-white/10 dark:bg-white/5"
              />
            </section>

            {/* 图像与裂变参数 Card (Matches Screenshot 1:1) */}
            <section className="rounded-[1.5rem] border border-[#d9e5f1] bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#11151c]">
              <h3 className="text-sm font-black text-[#17243c] dark:text-white">图像与裂变参数</h3>

              {/* 生成模型 Block */}
              <div className="mt-4 flex items-center justify-between rounded-2xl border border-[#f48c68] bg-[#fff8f3] p-3.5 shadow-xs transition dark:border-[#ed6d46]/50 dark:bg-white/5">
                <div>
                  <span className="block text-[0.68rem] font-bold text-[#718198]">生成模型</span>
                  <div className="mt-0.5 flex items-center gap-2">
                    <strong className="text-sm font-black text-[#17243c] dark:text-white">
                      Gemini 3.1 Flash Image
                    </strong>
                    <span className="rounded-full bg-[#ffefe8] px-2 py-0.5 text-[0.62rem] font-bold text-[#ed6d46] dark:bg-orange-950 dark:text-orange-300">
                      推荐
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-[#718198]" />
              </div>

              {/* 尺寸比例 & 裂变分辨率 Grid */}
              <div className="mt-3 grid grid-cols-2 gap-3">
                {/* 尺寸比例 */}
                <button
                  type="button"
                  onClick={() => setIsRatioModalOpen(true)}
                  className="flex flex-col justify-between rounded-2xl bg-[#edf4fc] p-3.5 text-left transition hover:bg-[#e2edf8] dark:bg-white/5"
                >
                  <span className="block text-[0.68rem] font-bold text-[#718198]">尺寸比例</span>
                  <div className="mt-1 flex items-center justify-between">
                    <strong className="text-sm font-black text-[#17243c] dark:text-white">
                      {FACE_SWAP_RATIO_OPTIONS.find((r) => r.id === activeRecord.aspectRatio)?.label || '2:3 竖版'}
                    </strong>
                    <ChevronRight className="h-4 w-4 text-[#718198]" />
                  </div>
                </button>

                {/* 裂变分辨率 */}
                <div className="relative flex flex-col justify-between rounded-2xl bg-[#edf4fc] p-3.5 transition hover:bg-[#e2edf8] dark:bg-white/5">
                  <span className="block text-[0.68rem] font-bold text-[#718198]">裂变分辨率</span>
                  <div className="relative mt-1 flex items-center justify-between">
                    <strong className="pointer-events-none text-sm font-black text-[#17243c] dark:text-white">
                      {activeRecord.resolution === ImageResolution.RES_2K
                        ? '2K 高清 (推荐)'
                        : activeRecord.resolution === ImageResolution.RES_4K
                        ? '4K 商业大图'
                        : '1K 标准'}
                    </strong>
                    <ChevronDown className="pointer-events-none h-4 w-4 text-[#718198]" />
                    <select
                      value={activeRecord.resolution}
                      onChange={(e) => patchActive({ resolution: e.target.value as ImageResolution })}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    >
                      <option value={ImageResolution.RES_2K}>2K 高清 (推荐)</option>
                      <option value={ImageResolution.RES_1K}>1K 标准</option>
                      <option value={ImageResolution.RES_4K}>4K 商业大图</option>
                    </select>
                  </div>
                </div>
              </div>
            </section>

            {/* Error Message & Action Button */}
            {activeRecord.error && (
              <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-600 dark:border-red-900/30 dark:bg-red-950/40 dark:text-red-400">
                <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                <span>{activeRecord.error}</span>
              </div>
            )}

            <div className="space-y-2 pt-2">
              {isGenerating ? (
                <button
                  type="button"
                  onClick={() => cancelGenerationTask('已手动停止生成')}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#17243c] py-4 text-sm font-black text-white shadow-lg transition hover:bg-[#253654] dark:bg-white dark:text-[#17243c]"
                >
                  <Loader2 className="h-4.5 w-4.5 animate-spin" /> 停止生成
                </button>
              ) : (
                <button
                  type="button"
                  onClick={runGeneration}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#17243c] via-[#233555] to-[#17243c] py-4 text-sm font-black text-white shadow-xl transition hover:opacity-95 dark:from-[#ed6d46] dark:to-[#f48c68]"
                >
                  <Sparkles className="h-4.5 w-4.5 text-[#ed6d46] dark:text-white" /> 开始生成
                </button>
              )}
              <p className="text-center text-[0.68rem] text-[#718198]">
                <button
                  type="button"
                  onClick={() => alert('模特换脸基于 Gemini AI 多模态人脸与身体姿势对齐算法，消耗标准计算资源。')}
                  className="underline hover:text-[#ed6d46]"
                >
                  点击查看计费说明
                </button>
              </p>
            </div>
          </div>

          {/* Right Main Output / Preview Area */}
          <div className="flex min-w-0 flex-col gap-4">
            {activeRecord.results.length > 0 ? (
              <section className="flex min-h-[34rem] flex-1 flex-col rounded-[1.75rem] border border-[#d9e5f1] bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#11151c]">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-white/10">
                  <div>
                    <h2 className="text-base font-black">换脸结果预览</h2>
                    <p className="mt-0.5 text-xs text-[#718198]">
                      已成功完成 {activeRecord.results.filter((r) => r.status === 'done').length} / {activeRecord.results.length} 张图片的面部替换
                    </p>
                  </div>
                  {isGenerating && (
                    <div className="flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> 批量渲染中...
                    </div>
                  )}
                </div>

                <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {activeRecord.results.map((res, index) => (
                    <article
                      key={res.id}
                      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-[#f8fafc] shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-white/5"
                    >
                      <div className="aspect-[3/4] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                        {res.status === 'done' && res.imageUrl ? (
                          <img src={res.imageUrl} alt={`结果 ${index + 1}`} className="h-full w-full object-cover" />
                        ) : res.status === 'processing' ? (
                          <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-[#ed6d46]" />
                            <span className="mt-3 text-xs font-bold text-slate-600 dark:text-slate-300">
                              正在换脸渲染 #{index + 1}...
                            </span>
                          </div>
                        ) : res.status === 'error' ? (
                          <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center text-red-500">
                            <AlertCircle className="h-8 w-8" />
                            <span className="mt-2 text-xs font-bold">换脸失败</span>
                            <span className="mt-1 text-[0.65rem] text-slate-400">{res.error}</span>
                          </div>
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                            等待处理...
                          </div>
                        )}
                      </div>

                      {res.status === 'done' && res.imageUrl && (
                        <div className="flex items-center justify-between border-t border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#181d26]">
                          <span className="truncate text-xs font-bold text-slate-700 dark:text-slate-200">
                            图片 #{index + 1}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedPreview(res.imageUrl!)}
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-black dark:hover:bg-white/10 dark:hover:text-white"
                              title="查看大图"
                            >
                              <Maximize2 className="h-4 w-4" />
                            </button>
                            <a
                              href={res.imageUrl}
                              download={`FaceSwap_${index + 1}.png`}
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-black dark:hover:bg-white/10 dark:hover:text-white"
                              title="下载"
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          </div>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            ) : (
              /* Idle Empty State Placeholder (Matches Image 1 & 4) */
              <section className="flex min-h-[34rem] flex-1 flex-col items-center justify-center rounded-[1.75rem] border-2 border-dashed border-[#cedbe8] bg-white/75 p-8 text-center dark:border-white/10 dark:bg-[#11151c]/75">
                <span className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-[#fff1e8] text-[#ed6d46]">
                  <UserCheck className="h-9 w-9" />
                </span>
                <h2 className="mt-5 text-xl font-black text-[#17243c] dark:text-white">开始生成</h2>
                <p className="mt-2 max-w-lg text-sm leading-7 text-[#718198]">
                  上传带模特图与参考人脸后，点击生成批量换脸。全流程保持模特姿势、服装质感与环境光影自然协调。
                </p>

                <div className="mt-6 grid w-full max-w-xl gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white p-4 text-left shadow-sm dark:bg-white/5">
                    <UserCheck className="h-5 w-5 text-[#ed6d46]" />
                    <strong className="mt-2 block text-xs font-black">1~15张带模特图</strong>
                    <span className="mt-1 block text-[0.68rem] text-[#718198]">批量换脸生成</span>
                  </div>
                  <div className="rounded-2xl bg-white p-4 text-left shadow-sm dark:bg-white/5">
                    <Sparkles className="h-5 w-5 text-[#2d6bb1]" />
                    <strong className="mt-2 block text-xs font-black">尺寸精准比例</strong>
                    <span className="mt-1 block text-[0.68rem] text-[#718198]">多平台比例适配</span>
                  </div>
                  <div className="rounded-2xl bg-white p-4 text-left shadow-sm dark:bg-white/5">
                    <WandSparkles className="h-5 w-5 text-emerald-600" />
                    <strong className="mt-2 block text-xs font-black">模特库与场景增强</strong>
                    <span className="mt-1 block text-[0.68rem] text-[#718198]">固定高精度一致性</span>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      {/* Model Library Modal */}
      {isModelModalOpen && (
        <ModelLibraryModal
          selectedModelId={activeRecord.selectedModelPersonaId}
          models={modelPersonas}
          onSelectModel={(m) => patchActive({ selectedModelPersonaId: m ? m.id : null })}
          onCreateModel={handleCreateModelPersona}
          onRenameModel={handleRenameModelPersona}
          onDeleteModel={handleDeleteModelPersona}
          onClose={() => setIsModelModalOpen(false)}
        />
      )}

      {/* Fullscreen Image Preview Modal */}
      {selectedPreview && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setSelectedPreview(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-2xl">
            <img src={selectedPreview} alt="大图预览" className="max-h-[90vh] object-contain" />
            <button
              type="button"
              onClick={() => setSelectedPreview(null)}
              className="absolute top-3 right-3 rounded-full bg-black/60 p-2 text-white hover:bg-black"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
      {/* Ratio Selection Modal (Matches User Screenshot 1:1) */}
      {isRatioModalOpen && (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-[#10203a]/60 p-4 backdrop-blur-sm"
          onClick={() => setIsRatioModalOpen(false)}
        >
          <div
            className="relative w-full max-w-4xl overflow-hidden rounded-[1.8rem] bg-white p-7 shadow-2xl dark:bg-[#15191f]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4.5 dark:border-white/10">
              <h2 className="text-base font-black text-[#17243c] dark:text-white">选择尺寸比例</h2>
              <button
                type="button"
                onClick={() => setIsRatioModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f0f5fb] text-slate-500 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
              {FACE_SWAP_RATIO_OPTIONS.map((opt) => {
                const isSelected = activeRecord.aspectRatio === opt.id;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      patchActive({ aspectRatio: opt.id });
                      setIsRatioModalOpen(false);
                    }}
                    className={`group relative flex min-h-[13.5rem] flex-col items-center justify-between rounded-2xl p-4 text-center transition ${
                      isSelected
                        ? 'border-2 border-[#17243c] bg-white shadow-md dark:border-white dark:bg-white/10'
                        : 'border border-[#e4ecf7] bg-[#f2f7fc] hover:border-[#cbd5e1] hover:bg-slate-100 dark:bg-white/5'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-3.5 right-3.5 flex h-5 w-5 items-center justify-center rounded-full border border-[#17243c] bg-white text-[#17243c] shadow-2xs dark:border-white dark:bg-white dark:text-[#17243c]">
                        <Check className="h-3 w-3 stroke-[3]" />
                      </span>
                    )}

                    {/* Graphic Outline Icon */}
                    <div className="flex h-16 w-full items-center justify-center">
                      <span
                        className={`inline-block rounded-md border-2 transition ${
                          isSelected
                            ? 'border-[#17243c] dark:border-white'
                            : 'border-[#17243c] opacity-80'
                        } ${opt.iconWidth} ${opt.iconHeight}`}
                      />
                    </div>

                    <div>
                      <strong className="block text-xs font-black text-[#17243c] dark:text-white">
                        {opt.label}
                      </strong>
                      <span className="mt-1 block text-[0.65rem] leading-4 text-[#718198]">
                        {opt.subLabel}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelFaceSwapTab;
