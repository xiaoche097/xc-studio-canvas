import React, { useEffect, useMemo, useRef, useState } from 'react';
import CreativeImageModelSelector from '../modules/Cyzx4/components/image-models/CreativeImageModelSelector';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Download,
  Image as ImageIcon,
  LoaderCircle,
  Maximize2,
  RefreshCw,
  Shirt,
  Sparkles,
  Trash2,
  UploadCloud,
  WandSparkles,
  X,
} from 'lucide-react';
import { gemini } from '../lib/gemini';
import { saveGeneratedProject } from '../services/projectHistoryService';
import { compressImageFiles } from '../modules/Cyzx4/utils/imageCompressor';
import { downloadImageFile } from '../modules/Cyzx4/utils/imageDownload';
import { buildOutfitDeconstructionPrompt } from '../data/outfitDeconstructionPrompt';

type TaskStatus = 'draft' | 'generating' | 'completed' | 'error';

interface OutfitTask {
  id: string;
  createdAt: number;
  source?: string;
  result?: string;
  instruction: string;
  status: TaskStatus;
  error?: string;
}

interface OutfitDeconstructionStudioProps {
  isActive?: boolean;
}

const IMAGE_MODELS = [
  { id: 'gpt-image-2', name: 'GPT Image 2', badge: '默认' },
  { id: 'gemini-3.1-flash-image-preview', name: 'Gemini 3.1 Flash Image', badge: '推荐' },
  { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image', badge: '精细' },
];

const createTask = (): OutfitTask => ({
  id: `outfit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  createdAt: Date.now(),
  instruction: '',
  status: 'draft',
});

const statusLabel: Record<TaskStatus, string> = {
  draft: '待上传',
  generating: '分离中',
  completed: '已完成',
  error: '生成失败',
};

const downloadImage = async (source: string, filename: string) => {
  try {
    await downloadImageFile(source, filename);
  } catch (error) {
    console.error('Outfit image download failed.', error);
    window.alert('图片下载失败，请稍后重试。');
  }
};

const getClipboardImageFile = (clipboardData: DataTransfer | null) => {
  if (!clipboardData) return undefined;
  const clipboardFile = Array.from(clipboardData.files).find((file) => file.type.startsWith('image/'));
  if (clipboardFile) return clipboardFile;
  return Array.from(clipboardData.items)
    .find((item) => item.kind === 'file' && item.type.startsWith('image/'))
    ?.getAsFile() || undefined;
};

export const OutfitDeconstructionStudio: React.FC<OutfitDeconstructionStudioProps> = ({ isActive = true }) => {
  const firstTask = useMemo(createTask, []);
  const [tasks, setTasks] = useState<OutfitTask[]>([firstTask]);
  const [activeTaskId, setActiveTaskId] = useState(firstTask.id);
  const [model, setModel] = useState(IMAGE_MODELS[0].id);
  const [resolution, setResolution] = useState('2K');
  const [selectionModal, setSelectionModal] = useState<'model' | 'resolution' | null>(null);
  const [deconstructionMode, setDeconstructionMode] = useState<'complete' | 'garments' | 'accessories'>('complete');
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ url: string; alt: string } | null>(null);
  const [isSourceDragActive, setIsSourceDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourceDragDepthRef = useRef(0);

  const activeTask = tasks.find((task) => task.id === activeTaskId) || tasks[0];

  const patchTask = (id: string, patch: Partial<OutfitTask>) => {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, ...patch } : task));
  };

  const addTask = () => {
    const task = createTask();
    setTasks((current) => [task, ...current]);
    setActiveTaskId(task.id);
  };

  const removeTask = (id: string) => {
    setTasks((current) => {
      const next = current.filter((task) => task.id !== id);
      if (next.length === 0) {
        const replacement = createTask();
        setActiveTaskId(replacement.id);
        return [replacement];
      }
      if (id === activeTaskId) setActiveTaskId(next[0].id);
      return next;
    });
  };

  const readImage = async (file: File) => {
    const [compressed] = await compressImageFiles([file]);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        patchTask(activeTask.id, { source: reader.result, result: undefined, status: 'draft', error: undefined });
      }
    };
    reader.readAsDataURL(compressed || file);
  };

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void readImage(file);
    event.target.value = '';
  };

  const onImageDragEnter = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    sourceDragDepthRef.current += 1;
    setIsSourceDragActive(true);
  };

  const onImageDragOver = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
  };

  const onImageDragLeave = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    sourceDragDepthRef.current = Math.max(0, sourceDragDepthRef.current - 1);
    if (sourceDragDepthRef.current === 0) setIsSourceDragActive(false);
  };

  const onImageDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    sourceDragDepthRef.current = 0;
    setIsSourceDragActive(false);
    const file = Array.from(event.dataTransfer.files).find((item) => item.type.startsWith('image/'));
    if (file) void readImage(file);
  };

  const generate = async (taskId = activeTask.id, sourceOverride?: string) => {
    const task = tasks.find((item) => item.id === taskId) || activeTask;
    const source = sourceOverride || task.source;
    if (!source || task.status === 'generating') return;

    patchTask(taskId, { status: 'generating', error: undefined, result: undefined });
    try {
      const modeInstruction = deconstructionMode === 'garments'
        ? 'Prioritize clearly visible garments. Include visible accessories only when their identity is certain.'
        : deconstructionMode === 'accessories'
          ? 'Pay extra attention to every clearly visible shoe, bag, belt, hat, scarf, sock, jewelry and eyewear item while still keeping the complete outfit.'
          : 'Produce the complete source-faithful outfit breakdown with every clearly visible garment and accessory.';
      const prompt = buildOutfitDeconstructionPrompt(`${modeInstruction}\n${task.instruction}`);
      const result = await gemini.generateImage(prompt, [source], {
        aspectRatio: '2:3',
        resolution,
        model,
      });
      patchTask(taskId, { status: 'completed', result });
      await saveGeneratedProject({
        type: 'OUTFIT_DECONSTRUCTION',
        generated: [result],
        original: [source],
        prompt,
        params: { model, resolution, aspectRatio: '2:3', deconstructionMode, instruction: task.instruction },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '图片生成失败，请检查模型配置后重试。';
      patchTask(taskId, { status: 'error', error: message });
    }
  };

  useEffect(() => {
    if (!isActive) return undefined;

    const handlePaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditingText = target?.isContentEditable
        || target?.tagName === 'INPUT'
        || target?.tagName === 'TEXTAREA'
        || target?.tagName === 'SELECT';
      if (isEditingText) return;

      const imageFile = getClipboardImageFile(event.clipboardData);
      if (!imageFile) return;

      event.preventDefault();
      void readImage(imageFile);
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isActive, activeTask.id]);

  useEffect(() => {
    if (!imagePreview) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setImagePreview(null);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [imagePreview]);

  const currentStep = !activeTask.source ? 1 : activeTask.status === 'generating' ? 2 : activeTask.result ? 4 : 1;

  return (
    <div className="no-scrollbar h-full min-h-0 overflow-x-hidden overflow-y-auto bg-[#f5f6f8] text-[#172238] dark:bg-[#080808] dark:text-white">
      <div className="mx-auto w-full max-w-[108rem] px-3 py-5 sm:px-5 lg:px-7">
      <header className="mb-6 text-center">
        <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-[#ed6d46]"><Sparkles className="h-3.5 w-3.5" /> AI 模特服饰分离</div>
        <h1 className="mt-1 text-2xl font-black tracking-tight">一键分离模特穿搭</h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">识别人物全部可见穿搭，生成 2:3 纯白底商品搭配全览</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs font-bold text-slate-400 sm:gap-4">
          {['上传穿搭图', '识别与保守重建', '白底商品化', '搭配全览'].map((label, index) => {
            const step = index + 1;
            const active = currentStep >= step;
            return (
              <React.Fragment key={label}>
                {index > 0 && <span className="h-px w-3 bg-slate-200 dark:bg-white/10 sm:w-7" />}
                <div className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition ${currentStep === step ? 'bg-[#172238] text-white shadow-sm ring-2 ring-[#172238]/20' : active ? 'bg-white text-[#172238] dark:bg-white/10 dark:text-white' : 'bg-white/50 text-slate-400 dark:bg-white/[0.03]'}`}>
                  <span className={`flex h-6 min-w-6 items-center justify-center rounded-full text-xs font-black ${currentStep === step ? 'bg-white text-[#172238]' : 'bg-slate-200 text-[#172238] dark:bg-slate-700 dark:text-white'}`}>{active && currentStep > step ? <Check className="h-3 w-3" /> : step}</span>
                  <span className="text-xs font-bold">{label}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </header>

      {historyCollapsed && (
        <button type="button" onClick={() => setHistoryCollapsed(false)} className="fixed bottom-5 left-4 z-40 flex min-h-12 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-black shadow-lg dark:border-white/10 dark:bg-[#111318] md:left-[16.25rem] lg:left-[17rem]">
          <ChevronRight className="h-4 w-4" /> 生成记录 <span className="rounded-full bg-slate-100 px-2 py-1 text-xs dark:bg-white/10">{tasks.length}</span>
        </button>
      )}

      <main className={`grid grid-cols-1 gap-4 ${historyCollapsed ? 'xl:grid-cols-[30rem_minmax(0,1fr)]' : 'xl:grid-cols-[16rem_30rem_minmax(0,1fr)]'}`}>
        {!historyCollapsed && <aside className="no-scrollbar fixed inset-y-3 left-3 z-[60] flex w-[min(17rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-white/10 dark:bg-[#111318] xl:sticky xl:top-4 xl:z-10 xl:h-[calc(100vh-7rem)] xl:w-auto xl:shadow-sm">
          <div className="flex items-start justify-between">
            <div><div className="font-black">生成记录</div><div className="text-xs text-slate-400">支持同时创建多个任务</div></div>
            <button onClick={() => setHistoryCollapsed((value) => !value)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">
              {historyCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
          <button onClick={addTask} className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#172238] px-3 text-sm font-black text-white transition hover:bg-[#243554]">
            <CirclePlus className="h-4 w-4" /> 新建任务
          </button>
          <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
            {tasks.map((task) => (
              <button key={task.id} onClick={() => setActiveTaskId(task.id)} className={`group relative w-full overflow-hidden rounded-xl border text-left transition ${task.id === activeTask.id ? 'border-[#ed6d46] bg-orange-50/70 dark:bg-orange-500/10' : 'border-slate-200 bg-white hover:border-orange-200 dark:border-white/10 dark:bg-white/[0.02]'}`}>
                <div className="relative aspect-square bg-slate-50 dark:bg-black/20">
                  {task.result || task.source ? <img src={task.result || task.source} className="h-full w-full object-cover" alt="任务缩略图" /> : <div className="flex h-full items-center justify-center"><ImageIcon className="h-7 w-7 text-slate-300" /></div>}
                  {task.status === 'generating' && <div className="absolute inset-0 flex items-center justify-center bg-[#172238]/65"><LoaderCircle className="h-6 w-6 animate-spin text-white" /></div>}
                  <span className="absolute inset-x-0 bottom-0 flex min-h-9 items-center justify-center gap-1 bg-[#172238]/90 text-xs font-black text-white">{task.status === 'generating' && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}{statusLabel[task.status]}</span>
                  <button onClick={(event) => { event.stopPropagation(); removeTask(task.id); }} className="absolute right-1.5 top-1.5 rounded-md bg-white/90 p-1 text-slate-400 opacity-0 shadow group-hover:opacity-100 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                <div className="flex items-center justify-between px-3 py-2 text-[0.7rem] text-slate-400"><span>{new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span>{task.source ? '1 张素材' : '等待素材'}</span></div>
              </button>
            ))}
          </div>
        </aside>}

        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#111318]">
            <div className="flex items-start gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#172238] text-[11px] font-black text-white">1</span>
              <div><h2 className="font-black">拆解模式</h2><p className="mt-0.5 text-[11px] text-slate-400">选择本次识别与商品化的侧重点</p></div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-xl bg-[#eef5ff] p-1.5 dark:bg-white/[0.04]">
              {[
                { id: 'complete', label: '完整搭配' },
                { id: 'garments', label: '服装优先' },
                { id: 'accessories', label: '配饰优先' },
              ].map((item) => (
                <button key={item.id} type="button" onClick={() => setDeconstructionMode(item.id as typeof deconstructionMode)} className={`rounded-lg px-2 py-2.5 text-[11px] font-black transition ${deconstructionMode === item.id ? 'border border-slate-200 bg-white text-[#172238] shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-white' : 'text-slate-500 hover:text-[#172238] dark:hover:text-white'}`}>{item.label}</button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#111318]">
            <div className="flex items-start justify-between">
              <div><h2 className="font-black">模特穿搭原图</h2><p className="mt-0.5 text-[11px] text-slate-400">上传 1 张清晰的全身或半身穿搭照片</p></div>
              <span className="text-xs font-bold text-slate-400">{activeTask.source ? '1/1' : '0/1'}</span>
            </div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFileChange} />
            {activeTask.source ? (
              <div
                className={`group relative mt-3 overflow-hidden rounded-xl border bg-slate-50 transition ${isSourceDragActive ? 'border-[#ed6d46] ring-2 ring-[#ed6d46]/20' : 'border-slate-200 dark:border-white/10'} dark:bg-black/20`}
                onDragEnter={onImageDragEnter}
                onDragOver={onImageDragOver}
                onDragLeave={onImageDragLeave}
                onDrop={onImageDrop}
              >
                <button
                  type="button"
                  onClick={() => setImagePreview({ url: activeTask.source!, alt: '穿搭原图' })}
                  className="relative block w-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ed6d46]"
                  aria-label="放大查看穿搭原图"
                >
                  <img src={activeTask.source} alt="穿搭原图" className="mx-auto max-h-72 w-full object-contain" />
                  <span className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[#172238]/70 text-white opacity-100 shadow-sm backdrop-blur-sm transition group-hover:bg-[#172238]/90 sm:opacity-0 sm:group-hover:opacity-100">
                    <Maximize2 className="h-4 w-4" />
                  </span>
                </button>
                <div className="absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-center gap-2 bg-[#172238]/80 p-2 transition group-hover:translate-y-0">
                  <button onClick={() => fileInputRef.current?.click()} className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-bold text-[#172238]">替换图片</button>
                  <button onClick={() => patchTask(activeTask.id, { source: undefined, result: undefined, status: 'draft' })} className="rounded-lg bg-white/15 px-3 py-1.5 text-[11px] font-bold text-white">移除</button>
                </div>
                {isSourceDragActive && (
                  <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#172238]/75 text-white backdrop-blur-[2px]">
                    <UploadCloud className="h-8 w-8" />
                    <span className="mt-2 text-sm font-black">松开即可替换参考图</span>
                    <span className="mt-1 text-[10px] text-white/70">旧的生成结果将自动清除</span>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={onImageDragEnter}
                onDragOver={onImageDragOver}
                onDragLeave={onImageDragLeave}
                onDrop={onImageDrop}
                onPaste={(event) => {
                  const file = getClipboardImageFile(event.clipboardData);
                  if (!file) return;
                  event.preventDefault();
                  event.stopPropagation();
                  void readImage(file);
                }}
                className={`mt-3 flex min-h-32 w-full flex-col items-center justify-center rounded-xl border border-dashed text-center transition ${isSourceDragActive ? 'border-[#ed6d46] bg-orange-50 ring-2 ring-[#ed6d46]/20 dark:bg-orange-500/10' : 'border-slate-200 bg-slate-50/70 hover:border-[#ed6d46]/50 hover:bg-orange-50/50 dark:border-white/10 dark:bg-white/[0.02]'}`}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-[#ed6d46] dark:bg-orange-500/10"><UploadCloud className="h-6 w-6" /></span>
                <span className="mt-3 text-sm font-black">拖拽、粘贴或点击上传</span>
                <span className="mt-1 text-[10px] text-slate-400">JPG、PNG、WEBP · 单张 ≤ 30MB</span>
              </button>
            )}
            <div className="mt-3 rounded-xl border border-orange-100 bg-orange-50/70 px-3 py-2.5 text-[10px] leading-5 text-orange-800 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-200">建议人物穿搭完整、服装边缘清晰。系统只分离真实可见单品，不会自动补齐被完全遮挡的配饰。</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#111318]">
            <h2 className="font-black">你的拆解要求 <span className="text-xs font-medium text-slate-400">（选填）</span></h2>
            <p className="mt-1 text-[11px] text-slate-400">补充需要重点保留的面料、纹理或配饰细节</p>
            <textarea value={activeTask.instruction} onChange={(event) => patchTask(activeTask.id, { instruction: event.target.value })} placeholder="例如：重点还原外套金属纽扣与裙装格纹；不要生成画面中不可见的鞋子。" className="mt-3 min-h-32 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-5 outline-none transition placeholder:text-slate-400 focus:border-[#ed6d46] dark:border-white/10 dark:bg-white/[0.03]" />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#111318]">
            <h2 className="font-black">图像与生成参数</h2>
            <CreativeImageModelSelector value={model} onChange={setModel} disabled={activeTask.status === 'generating'} title="" compact className="mt-3 border-0 bg-transparent p-0 shadow-none" />
            <button type="button" onClick={() => setSelectionModal('model')} className="hidden">
              <span><span className="block text-[10px] font-bold text-slate-400">生成模型</span><span className="mt-1 block text-xs font-black">{IMAGE_MODELS.find((item) => item.id === model)?.name}</span></span>
              <span className="flex items-center gap-2"><span className="rounded-full bg-orange-100 px-2 py-1 text-[9px] font-black text-[#ed6d46] dark:bg-orange-500/10">{IMAGE_MODELS.find((item) => item.id === model)?.badge}</span><ChevronRight className="h-4 w-4 text-slate-400" /></span>
            </button>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-[#eef5ff] p-3 dark:bg-white/[0.04]"><span className="block text-[10px] font-bold text-slate-400">尺寸比例</span><span className="mt-1 block text-xs font-black">2:3 竖版</span></div>
              <button type="button" onClick={() => setSelectionModal('resolution')} className="flex items-center justify-between rounded-xl bg-[#eef5ff] p-3 text-left transition hover:bg-[#e5f0ff] dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"><span><span className="block text-[10px] font-bold text-slate-400">分辨率</span><span className="mt-1 block text-xs font-black">{resolution}</span></span><ChevronRight className="h-4 w-4 text-slate-400" /></button>
            </div>
            <button onClick={() => void generate()} disabled={!activeTask.source || activeTask.status === 'generating'} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#172238] px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#243554] disabled:cursor-not-allowed disabled:opacity-40">
              {activeTask.status === 'generating' ? <><LoaderCircle className="h-4 w-4 animate-spin" /> 正在拆解穿搭...</> : <><WandSparkles className="h-4 w-4" /> 开始分离穿搭</>}
            </button>
          </div>
        </section>

        <section className="relative flex min-h-[42rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#111318] sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#ed6d46]" /><span className="text-sm font-black">分离效果预览</span></div>
            {activeTask.result && <div className="flex gap-2"><button onClick={() => void generate()} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-bold hover:border-orange-200 hover:text-[#ed6d46] dark:border-white/10"><RefreshCw className="h-3.5 w-3.5" /> 重新生成</button><button onClick={() => void downloadImage(activeTask.result!, `outfit-breakdown-${Date.now()}.png`)} className="flex items-center gap-1.5 rounded-lg bg-[#172238] px-3 py-2 text-[11px] font-bold text-white"><Download className="h-3.5 w-3.5" /> 下载原图</button></div>}
          </div>
          {!activeTask.result && activeTask.status !== 'error' && (
            <div className="mt-4 flex shrink-0 items-center gap-2 rounded-xl border border-orange-100 bg-orange-50/75 px-3 py-3 text-xs font-bold text-orange-800 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-200">
              {activeTask.status === 'generating' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <span className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-[9px]">✓</span>}
              {activeTask.status === 'generating' ? '穿搭拆解 Agent · 正在识别并重建单品' : activeTask.source ? '输入准备 Agent · 素材已就绪' : '输入准备 Agent · 等待素材'}
            </div>
          )}
          <div className="relative mt-4 flex min-h-0 flex-1 items-center justify-center overflow-auto bg-white p-6 dark:bg-[#111318]">
            {activeTask.status === 'generating' ? (
              <div className="max-w-sm text-center"><div className="relative mx-auto flex h-24 w-24 items-center justify-center"><div className="absolute inset-0 animate-ping rounded-full bg-orange-100 opacity-40 dark:bg-orange-500/20" /><div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-[#ed6d46] shadow-xl dark:bg-[#1d2028]"><Shirt className="h-8 w-8" /></div></div><h3 className="mt-5 text-lg font-black">正在识别并分离穿搭</h3><p className="mt-2 text-xs leading-6 text-slate-400">盘点可见单品 · 恢复服装结构 · 校验颜色材质 · 生成白底搭配全览</p><div className="mx-auto mt-5 h-1.5 w-56 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"><div className="h-full w-2/3 animate-pulse rounded-full bg-[#ed6d46]" /></div></div>
            ) : activeTask.result ? (
              <div className="flex h-full w-full flex-col items-center justify-center">
                <button
                  type="button"
                  onClick={() => setImagePreview({ url: activeTask.result!, alt: '穿搭分离结果' })}
                  className="group/result relative flex min-h-0 w-full flex-1 cursor-zoom-in items-center justify-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ed6d46]"
                  aria-label="放大查看生成图片"
                >
                  <img src={activeTask.result} alt="穿搭分离结果" className="max-h-full max-w-full rounded-lg bg-white object-contain shadow-xl" />
                  <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[#172238]/70 text-white opacity-100 shadow-lg backdrop-blur-sm transition group-hover/result:bg-[#172238]/90 sm:opacity-0 sm:group-hover/result:opacity-100">
                    <Maximize2 className="h-4 w-4" />
                  </span>
                </button>
                <div className="mt-3 flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><Check className="h-3.5 w-3.5" /> 已生成并保存到生成记录</div>
              </div>
            ) : activeTask.status === 'error' ? (
              <div className="max-w-md text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500 dark:bg-red-500/10"><X className="h-7 w-7" /></span><h3 className="mt-4 font-black">生成没有完成</h3><p className="mt-2 break-words text-xs leading-5 text-slate-400">{activeTask.error}</p><button onClick={() => void generate()} className="mt-4 rounded-xl bg-[#172238] px-4 py-2.5 text-xs font-bold text-white">重试生成</button></div>
            ) : (
              <div className="max-w-md text-center"><div className="mx-auto grid h-16 w-16 grid-cols-2 gap-1.5 rounded-2xl bg-slate-100 p-3 text-slate-300 dark:bg-white/5 dark:text-slate-600">{[0, 1, 2, 3].map((item) => <span key={item} className="rounded bg-current opacity-70" />)}</div><h3 className="mt-5 text-base font-black">上传模特穿搭图，查看完整拆解</h3><p className="mt-2 text-xs leading-6 text-slate-400">AI 会自动保留原始服装身份，只输出画面中可确认的单品，并整理为一张 2:3 纯白底搭配全览图。</p></div>
            )}
          </div>
        </section>
      </main>

      {selectionModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#172238]/45 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label={selectionModal === 'model' ? '选择生成模型' : '选择分辨率'}
          onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectionModal(null); }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#15171d]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
              <div><h3 className="text-base font-black">{selectionModal === 'model' ? '选择生成模型' : '选择分辨率'}</h3><p className="mt-1 text-[11px] text-slate-400">选择后不会自动生成，需要手动点击“开始分离穿搭”</p></div>
              <button type="button" onClick={() => setSelectionModal(null)} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white" aria-label="关闭选择弹窗"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-2 p-4">
              {selectionModal === 'model' ? IMAGE_MODELS.map((item) => {
                const selected = item.id === model;
                return (
                  <button key={item.id} type="button" onClick={() => { setModel(item.id); setSelectionModal(null); }} className={`flex min-h-14 w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${selected ? 'border-[#ed6d46] bg-orange-50 text-[#172238] dark:bg-orange-500/10 dark:text-white' : 'border-slate-200 hover:border-orange-200 hover:bg-orange-50/50 dark:border-white/10 dark:hover:bg-white/5'}`}>
                    <span><span className="block text-sm font-black">{item.name}</span><span className="mt-1 block text-[10px] text-slate-400">{item.badge}</span></span>
                    {selected && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#ed6d46] text-white"><Check className="h-3.5 w-3.5" /></span>}
                  </button>
                );
              }) : ['1K', '2K', '4K'].map((item) => {
                const selected = item === resolution;
                const description = item === '1K' ? '标准清晰度' : item === '2K' ? '高清（推荐）' : '超高清';
                return (
                  <button key={item} type="button" onClick={() => { setResolution(item); setSelectionModal(null); }} className={`flex min-h-14 w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${selected ? 'border-[#ed6d46] bg-orange-50 text-[#172238] dark:bg-orange-500/10 dark:text-white' : 'border-slate-200 hover:border-orange-200 hover:bg-orange-50/50 dark:border-white/10 dark:hover:bg-white/5'}`}>
                    <span><span className="block text-sm font-black">{item}</span><span className="mt-1 block text-[10px] text-slate-400">{description}</span></span>
                    {selected && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#ed6d46] text-white"><Check className="h-3.5 w-3.5" /></span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {imagePreview && (
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center bg-[#07101f]/92 p-4 backdrop-blur-sm sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={`${imagePreview.alt}大图预览`}
          onMouseDown={(event) => { if (event.target === event.currentTarget) setImagePreview(null); }}
        >
          <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-4 text-white sm:inset-x-8 sm:top-6">
            <div>
              <div className="text-sm font-black">{imagePreview.alt}</div>
              <div className="mt-1 text-[11px] text-white/60">点击空白区域或按 Esc 关闭</div>
            </div>
            <button
              type="button"
              onClick={() => setImagePreview(null)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="关闭大图预览"
              autoFocus
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <img
            src={imagePreview.url}
            alt={`${imagePreview.alt}大图`}
            className="max-h-[calc(100vh-8rem)] max-w-full select-none object-contain shadow-2xl"
          />
        </div>
      )}
      </div>
    </div>
  );
};
