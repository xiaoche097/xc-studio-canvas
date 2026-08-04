import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  Download,
  Image as ImageIcon,
  Loader2,
  Monitor,
  PackageCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Sparkles,
  Upload,
  WandSparkles,
  X,
  Zap,
} from 'lucide-react';
import { generateImageToImage, compressImage } from '../services/geminiService';
import { AspectRatio, ImageResolution } from '../types';
import { getErrorMessage, isAbortError } from '../utils/apiHelpers';
import { useCancelableGeneration } from '../hooks/useCancelableGeneration';
import { useImagePaste } from '../hooks/useImagePaste';
import { saveGeneratedProject } from '../../services/projectHistoryService';

type ProductCategory =
  | 'general'
  | 'jewelry'
  | 'hardware'
  | 'beauty'
  | 'electronics'
  | 'apparel'
  | 'shoes'
  | 'complex';

type GenerationStatus = 'pending' | 'generating' | 'done' | 'error';

type UploadedProduct = {
  id: string;
  name: string;
  mime: string;
  base64: string;
  preview: string;
};

type RetouchResult = {
  sourceId: string;
  sourceName: string;
  status: GenerationStatus;
  imageUrl?: string;
  error?: string;
};

type GenerationRecord = {
  id: string;
  createdAt: number;
  category: ProductCategory;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
  modelId: string;
  images: UploadedProduct[];
  results: RetouchResult[];
};

interface WhiteBackgroundRetouchTabProps {
  isActive?: boolean;
}

const MAX_IMAGES = 9;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const DEFAULT_MODEL_ID = 'gemini-3.1-flash-image-preview';

const MODEL_OPTIONS = [
  { id: 'gemini-3.1-flash-image-preview', label: 'Nano Banana 2', desc: '3.1 Flash', icon: 'banana' },
  { id: 'gemini-3-pro-image-preview', label: 'Banana Pro', desc: '3.0 Pro', icon: 'banana' },
  { id: 'gpt-image-2', label: 'GPT Image 2', desc: 'Ultra Quality', icon: 'sparkles' },
  { id: 'mj_imagine', label: 'Midjourney', desc: 'MJ Imagine', icon: 'magic' },
] as const;

const CATEGORY_OPTIONS: Array<{
  id: ProductCategory;
  label: string;
  prompt: string;
}> = [
  {
    id: 'general',
    label: '通用产品精修',
    prompt: 'Preserve the exact product identity, geometry, material, color, construction, details and product count. Improve clean commercial texture, edge quality and tonal separation without redesigning anything.',
  },
  {
    id: 'jewelry',
    label: '饰品珠宝产品',
    prompt: 'Preserve exact gemstone count, cut, setting, prongs, chain links, engravings and metal color. Render controlled jewelry highlights, clean metal reflections, gemstone transparency and premium micro-detail without changing the design.',
  },
  {
    id: 'hardware',
    label: '五金产品',
    prompt: 'Preserve exact mechanical geometry, dimensions, holes, threads, fasteners, edges, part count and assembly relationships. Enhance machined metal texture, brushed or polished finish and controlled neutral reflections without deforming the product.',
  },
  {
    id: 'beauty',
    label: '美妆产品',
    prompt: 'Preserve exact package silhouette, cap, pump, label placement, logo, printed text and colors. Refine glass, plastic or metallic packaging with clean cosmetic-ad highlights. Do not invent, rewrite or blur any packaging text.',
  },
  {
    id: 'electronics',
    label: '家电3C数码',
    prompt: 'Preserve exact industrial design, screen, ports, buttons, vents, seams, camera modules, accessories and product proportions. Improve premium plastic, glass and metal surfaces with controlled studio reflections. Keep all screen and label content unchanged.',
  },
  {
    id: 'apparel',
    label: '服饰',
    prompt: 'Preserve exact garment silhouette, pattern, color, fabric, stitching, buttons, pockets, collar, sleeves and hem. Refine fabric texture, remove dust and wrinkles only where appropriate, and keep the original flat-lay, mannequin or worn presentation unchanged.',
  },
  {
    id: 'shoes',
    label: '鞋类',
    prompt: 'Preserve exact shoe silhouette, left-right orientation, sole thickness, tread, laces, eyelets, stitching, panels, logo and material. Enhance leather, textile, rubber and edge cleanliness without changing construction or adding a second shoe.',
  },
  {
    id: 'complex',
    label: '复杂产品精修',
    prompt: 'Preserve every visible component, connector, cable, accessory, layer, opening, moving part and assembly relationship. Maintain exact product count and spatial relationships. Improve clarity and material separation without simplifying or hallucinating parts.',
  },
];

const ASPECT_OPTIONS = [
  { id: AspectRatio.SQUARE, label: '1:1 正方形' },
  { id: AspectRatio.PORTRAIT_3_4, label: '3:4 竖版' },
  { id: AspectRatio.LANDSCAPE_4_3, label: '4:3 横版' },
  { id: AspectRatio.PORTRAIT_9_16, label: '9:16 竖屏' },
  { id: AspectRatio.LANDSCAPE_16_9, label: '16:9 横屏' },
];

const buildRetouchPrompt = (category: ProductCategory) => {
  const categoryRule = CATEGORY_OPTIONS.find((item) => item.id === category)?.prompt || CATEGORY_OPTIONS[0].prompt;
  return `
# ROLE: Senior Ecommerce Product Retoucher
# INPUT: Image 1 is the only product source of truth.

# TASK
Transform Image 1 into a premium ecommerce white-background packshot. This is precision retouching, not product redesign.

# CATEGORY-SPECIFIC STANDARD
${categoryRule}

# IDENTITY AND GEOMETRY LOCK — HIGHEST PRIORITY
- Keep the exact same product, product count, camera angle, perspective, orientation, pose, proportions, crop logic and visible side as Image 1.
- Preserve every logo, label, printed character, pattern, color block, seam, opening, accessory and structural detail exactly as visible.
- Do not add, remove, duplicate, mirror, rotate, reshape, simplify or replace any product part.
- Do not turn a single product into a pair or a set. Do not complete hidden or cropped structures by guessing.

# WHITE BACKGROUND AND COMPOSITION
- Output a uniform seamless pure white background #FFFFFF across every corner and open area.
- No gray background, off-white, warm white, gradient, horizon line, wall, floor texture, props, people, hands or environment.
- Center the product with balanced ecommerce margins. Keep the full product visible whenever the source contains the full product.
- Add only a restrained physically plausible contact shadow directly beneath the product. The surrounding background must remain pure white.

# COMMERCIAL RETOUCHING
- Clean dust, sensor spots, rough cutout edges, color cast, compression artifacts and distracting defects.
- Improve sharpness, material texture, highlight control, tonal separation and realistic depth without over-smoothing or creating a plastic CGI look.
- Keep colors accurate to Image 1 and use neutral white balance.

# FORBIDDEN
No captions, no new text, no watermark, no border, no collage, no before-and-after layout, no decorative graphics, no extra objects, no invented branding.
`;
};

const toDataUrl = (image: UploadedProduct) => `data:${image.mime};base64,${image.base64}`;

const createGenerationRecord = (): GenerationRecord => ({
  id: crypto.randomUUID(),
  createdAt: Date.now(),
  category: 'general',
  aspectRatio: AspectRatio.SQUARE,
  resolution: ImageResolution.RES_2K,
  modelId: DEFAULT_MODEL_ID,
  images: [],
  results: [],
});

const WhiteBackgroundRetouchTab: React.FC<WhiteBackgroundRetouchTabProps> = ({ isActive = true }) => {
  const [images, setImages] = useState<UploadedProduct[]>([]);
  const [category, setCategory] = useState<ProductCategory>('general');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.SQUARE);
  const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.RES_2K);
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL_ID);
  const [results, setResults] = useState<RetouchResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const initialRecordRef = useRef<GenerationRecord | null>(null);
  if (!initialRecordRef.current) initialRecordRef.current = createGenerationRecord();
  const [generationRecords, setGenerationRecords] = useState<GenerationRecord[]>([initialRecordRef.current]);
  const [activeRecordId, setActiveRecordId] = useState<string>(initialRecordRef.current.id);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    cancelMessage,
    startGenerationTask,
    cancelGenerationTask,
    assertCurrentGenerationTask,
    finishGenerationTask,
  } = useCancelableGeneration();

  const completedCount = results.filter((item) => item.status === 'done' || item.status === 'error').length;
  const successfulResults = useMemo(() => results.filter((item) => item.status === 'done' && item.imageUrl), [results]);

  const processFiles = useCallback(async (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    const oversized = imageFiles.filter((file) => file.size > MAX_FILE_SIZE);
    const accepted = imageFiles
      .filter((file) => file.size <= MAX_FILE_SIZE)
      .slice(0, Math.max(0, MAX_IMAGES - images.length));

    if (!accepted.length) {
      if (oversized.length) setError('单张图片不能超过 10MB。');
      else if (imageFiles.length) setError(`最多上传 ${MAX_IMAGES} 张产品图。`);
      else setError('请选择 JPG、JPEG、PNG 或 WEBP 图片。');
      return;
    }

    try {
      const uploaded = await Promise.all(accepted.map(async (file): Promise<UploadedProduct> => {
        const compressed = await compressImage(file, 2048, 0.94);
        return {
          id: crypto.randomUUID(),
          name: file.name || `粘贴图片-${Date.now()}.png`,
          mime: compressed.mime,
          base64: compressed.base64,
          preview: `data:${compressed.mime};base64,${compressed.base64}`,
        };
      }));
      const nextImages = [...images, ...uploaded].slice(0, MAX_IMAGES);
      setImages(nextImages);
      setResults([]);
      setGenerationRecords((current) => current.map((record) => record.id === activeRecordId
        ? { ...record, images: nextImages, results: [] }
        : record));
      if (oversized.length || imageFiles.length > accepted.length) {
        setError(`部分图片未加入：最多 ${MAX_IMAGES} 张，且单张不超过 10MB。`);
      } else {
        setError(null);
      }
    } catch (uploadError) {
      setError(getErrorMessage(uploadError));
    }
  }, [activeRecordId, images]);

  useImagePaste((files) => void processFiles(files), isActive && !isGenerating);

  const removeImage = (id: string) => {
    const nextImages = images.filter((image) => image.id !== id);
    const nextResults = results.filter((result) => result.sourceId !== id);
    setImages(nextImages);
    setResults(nextResults);
    setGenerationRecords((current) => current.map((record) => record.id === activeRecordId
      ? { ...record, images: nextImages, results: nextResults }
      : record));
  };

  const updateResult = (sourceId: string, patch: Partial<RetouchResult>, recordId?: string) => {
    setResults((current) => current.map((item) => item.sourceId === sourceId ? { ...item, ...patch } : item));
    if (recordId) {
      setGenerationRecords((current) => current.map((record) => record.id === recordId
        ? { ...record, results: record.results.map((item) => item.sourceId === sourceId ? { ...item, ...patch } : item) }
        : record));
    }
  };

  const startNewRecord = () => {
    if (isGenerating) return;
    const record = createGenerationRecord();
    setGenerationRecords((current) => [record, ...current].slice(0, 20));
    setActiveRecordId(record.id);
    setImages([]);
    setResults([]);
    setCategory(record.category);
    setAspectRatio(record.aspectRatio);
    setResolution(record.resolution);
    setSelectedModel(record.modelId);
    setError(null);
    if (window.innerWidth < 1280) setIsHistoryOpen(false);
  };

  const openRecord = (record: GenerationRecord) => {
    if (isGenerating) return;
    setActiveRecordId(record.id);
    setImages(record.images);
    setResults(record.results);
    setCategory(record.category);
    setAspectRatio(record.aspectRatio);
    setResolution(record.resolution);
    setSelectedModel(record.modelId);
    setError(null);
    if (window.innerWidth < 1280) setIsHistoryOpen(false);
  };

  const removeRecord = (recordId: string) => {
    setGenerationRecords((current) => current.filter((record) => record.id !== recordId));
    if (activeRecordId === recordId) startNewRecord();
  };

  const handleGenerate = async () => {
    if (!images.length || isGenerating) return;
    const { taskId, signal } = startGenerationTask();
    const recordId = activeRecordId;
    const prompt = buildRetouchPrompt(category);
    const initialResults = images.map((image) => ({ sourceId: image.id, sourceName: image.name, status: 'pending' as const }));
    setIsGenerating(true);
    setError(null);
    setResults(initialResults);
    setActiveRecordId(recordId);
    setGenerationRecords((current) => current.map((record) => record.id === recordId ? {
      ...record,
      createdAt: Date.now(),
      category,
      aspectRatio,
      resolution,
      modelId: selectedModel,
      images: [...images],
      results: initialResults,
    } : record));

    try {
      const generated = await Promise.all(images.map(async (image): Promise<RetouchResult> => {
        updateResult(image.id, { status: 'generating' }, recordId);
        try {
          const [imageUrl] = await generateImageToImage(
            [{ base64: image.base64, mimeType: image.mime }],
            prompt,
            {
              aspectRatio,
              resolution,
              modelId: selectedModel,
              workflowHint: 'product-retouching',
              signal,
            },
          );
          if (!imageUrl) throw new Error('模型未返回图片。');
          updateResult(image.id, { status: 'done', imageUrl }, recordId);
          return { sourceId: image.id, sourceName: image.name, status: 'done', imageUrl };
        } catch (generationError) {
          if (isAbortError(generationError)) throw generationError;
          const message = getErrorMessage(generationError);
          updateResult(image.id, { status: 'error', error: message }, recordId);
          return { sourceId: image.id, sourceName: image.name, status: 'error', error: message };
        }
      }));

      assertCurrentGenerationTask(taskId, signal);
      const completed = generated.filter((item) => item.status === 'done' && item.imageUrl);
      if (completed.length) {
        await saveGeneratedProject({
          type: 'RETOUCHING',
          generated: completed.map((item) => item.imageUrl!),
          original: images.map(toDataUrl),
          prompt,
          params: {
            source: 'Cyzx4/components/WhiteBackgroundRetouchTab',
            subType: 'universal_white_background_retouch',
            category,
            aspectRatio,
            resolution,
            model: selectedModel,
            count: completed.length,
          },
        });
      }
    } catch (generationError) {
      if (!isAbortError(generationError)) setError(getErrorMessage(generationError));
    } finally {
      finishGenerationTask(taskId);
      setIsGenerating(false);
    }
  };

  const handleCancel = () => {
    cancelGenerationTask('已停止白底图精修');
    setIsGenerating(false);
  };

  const downloadImage = (imageUrl: string, index: number) => {
    const anchor = document.createElement('a');
    anchor.href = imageUrl;
    anchor.download = `white-background-retouch-${index + 1}-${Date.now()}.png`;
    anchor.click();
  };

  const downloadAll = () => {
    successfulResults.forEach((result, index) => {
      if (result.imageUrl) window.setTimeout(() => downloadImage(result.imageUrl!, index), index * 160);
    });
  };

  return (
    <div className="no-scrollbar h-full min-h-0 overflow-x-hidden overflow-y-auto bg-[#f5f6f8] text-pastel-text dark:bg-[#080808]">
      <div className="mx-auto w-full max-w-[96rem] px-3 py-6 sm:px-5 lg:px-8">
        <header className="mb-6 text-center sm:mb-8">
          <div className="inline-flex items-center gap-2 text-xs font-black tracking-[0.14em] text-pastel-muted">
            <Sparkles className="h-4 w-4 text-pastel-highlight" />
            AI 产品图精修
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">一键生成白底组图</h1>
          <p className="mt-2 text-sm text-pastel-muted">上传产品图，每张图片独立生成一张高质量白底精修图</p>
          <div className="mt-5 flex items-center justify-center gap-3 text-xs font-bold text-pastel-muted sm:gap-5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#172238] text-white">1</span><span className="text-pastel-text">输入</span>
            <span className="h-px w-6 bg-pastel-border" /><span>2</span><span>生成中</span>
            <span className="h-px w-6 bg-pastel-border" /><span>3</span><span>完成</span>
          </div>
        </header>

        {!isHistoryOpen && (
          <button
            type="button"
            onClick={() => setIsHistoryOpen(true)}
            className="fixed bottom-5 left-4 z-40 flex min-h-12 items-center gap-2 rounded-full border border-pastel-border bg-pastel-card px-4 text-sm font-black shadow-[0_8px_24px_rgba(30,35,45,0.12)] transition hover:-translate-y-0.5 hover:border-orange-300 md:left-[16.25rem] lg:left-[17rem]"
            aria-label="打开生成记录"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#172238] text-white"><PanelLeftOpen className="h-4 w-4" /></span>
            生成记录
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-pastel-bg px-1.5 text-xs text-pastel-muted">{generationRecords.length}</span>
          </button>
        )}

        {isHistoryOpen && <button type="button" className="fixed inset-0 z-[69] bg-black/30 xl:hidden" onClick={() => setIsHistoryOpen(false)} aria-label="收起生成记录" />}

        <div className={`grid grid-cols-1 gap-5 ${isHistoryOpen ? 'xl:grid-cols-[17rem_30rem_minmax(0,1fr)]' : 'xl:grid-cols-[30rem_minmax(0,1fr)]'}`}>
          {isHistoryOpen && (
            <aside className="no-scrollbar fixed inset-y-3 left-3 z-[70] flex w-[min(18rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-pastel-border bg-pastel-card p-3 shadow-[0_12px_36px_rgba(30,35,45,0.14)] xl:sticky xl:top-4 xl:z-10 xl:h-[calc(100vh-7rem)] xl:w-auto xl:self-start xl:shadow-sm">
              <div className="flex items-start justify-between gap-2 px-1 py-1">
                <div>
                  <h2 className="font-black">生成记录</h2>
                  <p className="mt-0.5 text-xs text-pastel-muted">可同时保留并查看任务</p>
                </div>
                <button type="button" onClick={() => setIsHistoryOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-pastel-border text-pastel-muted transition hover:border-orange-300 hover:text-pastel-highlight" aria-label="收起生成记录"><PanelLeftClose className="h-4 w-4" /></button>
              </div>

              <button type="button" onClick={startNewRecord} disabled={isGenerating} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#172238] px-3 text-sm font-black text-white transition hover:bg-[#26344f] disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4" />新开任务</button>

              <div className="no-scrollbar mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pb-2">
                {generationRecords.length === 0 ? (
                  <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-pastel-border px-5 text-center">
                    <PackageCheck className="h-8 w-8 text-pastel-border" />
                    <p className="mt-3 text-sm font-bold text-pastel-muted">生成任务会保存在这里</p>
                  </div>
                ) : generationRecords.map((record) => {
                  const doneCount = record.results.filter((item) => item.status === 'done').length;
                  const errorCount = record.results.filter((item) => item.status === 'error').length;
                  const working = record.results.some((item) => item.status === 'pending' || item.status === 'generating');
                  const isDraft = record.results.length === 0;
                  const cover = record.results.find((item) => item.imageUrl)?.imageUrl || record.images[0]?.preview;
                  const categoryLabel = CATEGORY_OPTIONS.find((item) => item.id === record.category)?.label;
                  return (
                    <article key={record.id} className={`group relative overflow-hidden rounded-xl border bg-pastel-bg/40 transition ${activeRecordId === record.id ? 'border-pastel-highlight ring-2 ring-orange-100 dark:ring-orange-500/10' : 'border-pastel-border hover:border-orange-300'}`}>
                      <button type="button" onClick={() => openRecord(record)} disabled={isGenerating && activeRecordId !== record.id} className="block w-full text-left disabled:cursor-not-allowed">
                        <div className={`relative aspect-square bg-white ${isDraft ? 'm-1 rounded-lg border border-dashed border-pastel-border' : ''}`}>
                          {cover ? <img src={cover} alt="任务预览" className={`h-full w-full object-cover ${working && !record.results.some((item) => item.imageUrl) ? 'opacity-45' : ''}`} /> : <ImageIcon className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 text-pastel-border" />}
                          {working && <span className="absolute inset-x-0 bottom-0 flex min-h-9 items-center justify-center gap-1.5 bg-[#172238]/90 px-2 text-xs font-black text-white"><Loader2 className="h-3.5 w-3.5 animate-spin" />生成中 {doneCount}/{record.results.length}</span>}
                          {!working && <span className={`absolute inset-x-0 bottom-0 flex min-h-9 items-center justify-center px-2 text-xs font-black text-white ${errorCount ? 'bg-amber-600/90' : 'bg-[#172238]/90'}`}>{isDraft ? '编辑中' : errorCount ? `完成 ${doneCount} · 失败 ${errorCount}` : `已完成 ${doneCount} 张`}</span>}
                        </div>
                        <div className="px-3 py-2.5">
                          <p className="truncate text-xs font-black">{categoryLabel}</p>
                          <p className="mt-1 text-[0.7rem] text-pastel-muted">{new Date(record.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} · {record.images.length ? `${record.images.length} 张产品图` : '等待上传'}</p>
                        </div>
                      </button>
                      {!working && <button type="button" onClick={() => removeRecord(record.id)} className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-pastel-muted opacity-100 shadow-sm transition hover:bg-red-500 hover:text-white sm:opacity-0 sm:group-hover:opacity-100" aria-label="删除生成记录"><X className="h-3.5 w-3.5" /></button>}
                    </article>
                  );
                })}
              </div>
            </aside>
          )}
          <div className="space-y-4">
            <section className="rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"><ImageIcon className="h-5 w-5" /></span>
                  <div><h2 className="font-black">产品图</h2><p className="text-xs text-pastel-muted">上传清晰的产品图片</p></div>
                </div>
                <span className="text-xs font-bold text-pastel-muted">{images.length}/{MAX_IMAGES}</span>
              </div>

              {images.length === 0 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => { event.preventDefault(); void processFiles(Array.from(event.dataTransfer.files)); }}
                  className="flex min-h-32 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-pastel-border bg-pastel-bg/40 p-4 text-center transition hover:border-orange-300 hover:bg-orange-50/40 dark:hover:bg-orange-500/5"
                >
                  <Upload className="h-7 w-7 text-pastel-highlight" />
                  <span className="mt-3 text-sm font-bold">拖拽或点击选择文件</span>
                  <span className="mt-1 text-xs text-pastel-muted">JPG、JPEG、PNG、WEBP，也可 Ctrl+V 粘贴</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => { void processFiles(Array.from(event.target.files || [])); event.target.value = ''; }}
              />

              {images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {images.map((image, index) => (
                    <div key={image.id} className="group relative h-[4.5rem] w-[4.5rem] overflow-hidden rounded-xl border border-pastel-border bg-white sm:h-20 sm:w-20">
                      <img src={image.preview} alt={`产品图 ${index + 1}`} className="h-full w-full object-cover" />
                      <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[0.65rem] font-bold text-white">{index + 1}</span>
                      <button type="button" onClick={() => removeImage(image.id)} disabled={isGenerating} className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-lg bg-black/55 text-white opacity-100 transition hover:bg-red-500 sm:opacity-0 sm:group-hover:opacity-100" aria-label="删除产品图"><X className="h-4 w-4" /></button>
                    </div>
                  ))}
                  {images.length < MAX_IMAGES && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => { event.preventDefault(); void processFiles(Array.from(event.dataTransfer.files)); }}
                      disabled={isGenerating}
                      className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-xl border border-dashed border-pastel-border bg-pastel-bg/30 text-pastel-muted transition hover:border-orange-300 hover:bg-orange-50 hover:text-pastel-highlight disabled:cursor-not-allowed disabled:opacity-50 sm:h-20 sm:w-20"
                      aria-label="继续添加产品图"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  )}
                </div>
              )}
              <div className="mt-4 rounded-xl border border-pastel-border bg-pastel-bg/50 px-3 py-2 text-xs leading-5 text-pastel-muted">支持格式：JPG、JPEG、PNG、WEBP<br />单张图片不超过 10MB</div>
            </section>

            <section className="rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm sm:p-5">
              <label className="block text-xs font-black">品类
                <select value={category} onChange={(event) => { const value = event.target.value as ProductCategory; setCategory(value); setGenerationRecords((current) => current.map((record) => record.id === activeRecordId ? { ...record, category: value } : record)); }} disabled={isGenerating} className="mt-2 min-h-11 w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-sm font-bold outline-none focus:border-pastel-highlight">
                  {CATEGORY_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
            </section>

            <section className="rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm sm:p-5">
              <h2 className="mb-3 flex items-center gap-2 text-xs font-black text-pastel-muted"><Cpu className="h-4 w-4" />图像模型选择</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {MODEL_OPTIONS.map((model) => {
                  const selected = selectedModel === model.id;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      disabled={isGenerating}
                      onClick={() => { setSelectedModel(model.id); setGenerationRecords((current) => current.map((record) => record.id === activeRecordId ? { ...record, modelId: model.id } : record)); }}
                      className={`flex min-h-[4.5rem] flex-col items-center justify-center rounded-xl border px-2 py-2 text-center transition disabled:cursor-not-allowed disabled:opacity-50 ${selected ? 'border-violet-400 bg-violet-50 text-violet-800 ring-2 ring-violet-100 dark:bg-violet-500/10 dark:text-violet-200 dark:ring-violet-500/10' : 'border-pastel-border bg-pastel-bg/60 hover:border-violet-200 hover:bg-violet-50/50 dark:hover:bg-violet-500/5'}`}
                    >
                      <span className="flex items-center gap-1 text-[0.68rem] font-black leading-tight">
                        {model.icon === 'banana' ? <Zap className="h-3.5 w-3.5 text-amber-500" /> : model.icon === 'sparkles' ? <Sparkles className="h-3.5 w-3.5 text-orange-500" /> : <WandSparkles className="h-3.5 w-3.5 text-sky-500" />}
                        {model.label}
                      </span>
                      <span className="mt-1 text-[0.6rem] text-pastel-muted">{model.desc}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm sm:p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block text-xs font-black"><span className="flex items-center gap-2 text-pastel-muted"><Monitor className="h-4 w-4" />画幅比例</span>
                  <select value={aspectRatio} onChange={(event) => { const value = event.target.value as AspectRatio; setAspectRatio(value); setGenerationRecords((current) => current.map((record) => record.id === activeRecordId ? { ...record, aspectRatio: value } : record)); }} disabled={isGenerating} className="mt-2 min-h-11 w-full rounded-xl border-2 border-blue-300 bg-pastel-bg px-3 text-sm font-black outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                    {ASPECT_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-black"><span className="flex items-center gap-2 text-pastel-muted"><Cpu className="h-4 w-4" />画质精度</span>
                  <select value={resolution} onChange={(event) => { const value = event.target.value as ImageResolution; setResolution(value); setGenerationRecords((current) => current.map((record) => record.id === activeRecordId ? { ...record, resolution: value } : record)); }} disabled={isGenerating} className="mt-2 min-h-11 w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-sm font-black outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                    <option value={ImageResolution.RES_1K}>1K（标准）</option>
                    <option value={ImageResolution.RES_2K}>2K（高清）</option>
                    <option value={ImageResolution.RES_4K}>4K（超清）</option>
                  </select>
                </label>
              </div>
            </section>

            <button type="button" onClick={handleGenerate} disabled={!images.length || isGenerating} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-pastel-highlight px-4 text-base font-black text-white shadow-md transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:shadow-none">
              {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <WandSparkles className="h-5 w-5" />}
              {isGenerating ? `正在生成 ${completedCount}/${images.length}` : '开始生图'}
            </button>
            {isGenerating && <button type="button" onClick={handleCancel} className="min-h-12 w-full rounded-2xl bg-gray-900 px-4 text-sm font-bold text-white">停止生成</button>}
            {cancelMessage && !isGenerating && <p className="text-center text-sm font-bold text-orange-600">{cancelMessage}</p>}
          </div>

          <section className="flex min-h-[38rem] flex-col rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm sm:p-5 xl:min-h-[48rem]">
            <div className="flex flex-col gap-3 border-b border-pastel-border pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="flex items-center gap-2 font-black"><Sparkles className="h-4 w-4 text-pastel-highlight" />开始生成</h2><p className="mt-1 text-xs text-pastel-muted">上传几张产品图，即并发生成几张白底精修图</p></div>
              {successfulResults.length > 1 && <button type="button" onClick={downloadAll} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-xs font-bold text-white dark:bg-white dark:text-black"><Download className="h-4 w-4" />全部下载</button>}
            </div>

            {error && <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

            {!results.length ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center text-pastel-muted">
                <Sparkles className="h-14 w-14 text-pastel-border" />
                <p className="mt-5 max-w-sm text-sm leading-6">上传产品图并选择品类后，点击左侧“开始生图”</p>
              </div>
            ) : (
              <div className="no-scrollbar grid grid-cols-1 content-start gap-4 overflow-y-auto pt-5 sm:grid-cols-2 2xl:grid-cols-3">
                {results.map((result, index) => {
                  const source = images.find((image) => image.id === result.sourceId);
                  return (
                    <article key={result.sourceId} className="overflow-hidden rounded-2xl border border-pastel-border bg-pastel-bg/40">
                      <div className="relative aspect-square bg-white">
                        {result.imageUrl ? <img src={result.imageUrl} alt={`白底精修结果 ${index + 1}`} className="h-full w-full object-contain" /> : source ? <img src={source.preview} alt="待精修产品" className="h-full w-full object-contain opacity-35" /> : null}
                        {(result.status === 'pending' || result.status === 'generating') && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/65 text-orange-600 backdrop-blur-[2px]"><Loader2 className="h-7 w-7 animate-spin" /><span className="text-xs font-black">{result.status === 'pending' ? '等待生成' : '精修生成中'}</span></div>}
                        {result.status === 'error' && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-red-50/90 p-4 text-center text-red-600"><AlertCircle className="h-7 w-7" /><span className="text-xs font-bold">{result.error || '生成失败'}</span></div>}
                        {result.status === 'done' && <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-green-500 px-2 py-1 text-[0.65rem] font-bold text-white"><CheckCircle2 className="h-3 w-3" />已完成</span>}
                      </div>
                      <div className="flex min-h-14 items-center justify-between gap-2 border-t border-pastel-border px-3">
                        <span className="min-w-0 truncate text-xs font-bold">{result.sourceName}</span>
                        {result.imageUrl && <div className="flex shrink-0 gap-1"><button type="button" onClick={() => setSelectedPreview(result.imageUrl!)} className="flex h-10 w-10 items-center justify-center rounded-lg text-pastel-muted hover:bg-white hover:text-pastel-highlight" aria-label="预览结果"><ImageIcon className="h-4 w-4" /></button><button type="button" onClick={() => downloadImage(result.imageUrl!, index)} className="flex h-10 w-10 items-center justify-center rounded-lg text-pastel-muted hover:bg-white hover:text-pastel-highlight" aria-label="下载结果"><Download className="h-4 w-4" /></button></div>}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {selectedPreview && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" onClick={() => setSelectedPreview(null)}><button type="button" onClick={() => setSelectedPreview(null)} className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white" aria-label="关闭预览"><X className="h-5 w-5" /></button><img src={selectedPreview} alt="白底精修大图预览" className="max-h-[88vh] max-w-full rounded-xl bg-white object-contain" /></div>}
    </div>
  );
};

export default WhiteBackgroundRetouchTab;
