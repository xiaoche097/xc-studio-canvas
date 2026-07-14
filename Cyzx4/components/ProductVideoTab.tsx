import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Clapperboard,
  Download,
  Film,
  Image as ImageIcon,
  Layers3,
  Loader2,
  Maximize2,
  PanelLeftOpen,
  Play,
  Plus,
  Sparkles,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { compressImage, generateImageToImage, generateText } from '../services/geminiService';
import { generateVideo } from '../../XcAISTUDIO-main/services/geminiService';
import { useImagePaste } from '../hooks/useImagePaste';
import { getErrorMessage } from '../utils/apiHelpers';
import { AspectRatio, ImageResolution } from '../types';

type CreationMode = 'create' | 'replicate';
type Stage = 1 | 2 | 3 | 4;
type TaskStatus = 'editing' | 'planning' | 'ready' | 'generating' | 'done' | 'error';

type ProductAsset = { id: string; name: string; mime: string; base64: string; preview: string };
type ScriptScene = { time: string; visual: string; audio: string; overlay: string; prompt?: string };
type CreativeScheme = { id: string; title: string; summary: string; strategy: string; scenes: ScriptScene[] };
type KeyframeResult = { schemeId: string; imageUrl: string; qaPassed: boolean; qaNotes: string };
type VideoWorkspace = {
  mode: CreationMode;
  images: ProductAsset[];
  requirements: string;
  model: string;
  aspectRatio: string;
  duration: number;
  count: number;
  stage: Stage;
  schemes: CreativeScheme[];
  selectedSchemeIds: string[];
  keyframes: KeyframeResult[];
  agentStatus: string;
  agentLog: string[];
};
type VideoTask = {
  id: string;
  createdAt: number;
  status: TaskStatus;
  cover?: string;
  videos: string[];
  workspace: VideoWorkspace;
};

interface ProductVideoTabProps { isActive?: boolean }

const MAX_IMAGES = 3;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const STANDARD_VIDEO_VERSIONS = [
  { id: 'seedance-2.0', label: '标准版', hint: 'Seedance 2.0' },
  { id: 'veo-3.1-fast-generate-preview', label: '极速版', hint: 'Veo 3.1 Fast' },
  { id: 'veo-3.1-generate-preview', label: '高质量版', hint: 'Veo 3.1 Pro' },
] as const;

const XIAOCHE_VIDEO_VERSIONS = [
  { id: 'seedance-2.0', label: '标准版', hint: 'Seedance 2.0' },
  { id: 'xiaoche-omni-flash', label: '全能版', hint: 'Omni Flash' },
  { id: 'xiaoche-veo-3.1-lite', label: '轻量版', hint: 'Veo 3.1 Lite' },
  { id: 'xiaoche-veo-3.1-fast', label: '极速版', hint: 'Veo 3.1 Fast' },
  { id: 'xiaoche-veo-3.1-quality', label: '高质量版', hint: 'Veo 3.1 Quality' },
] as const;

const isXiaocheVideoEnabled = () => typeof window !== 'undefined'
  && Boolean(localStorage.getItem('xiaoche_api_key'))
  && localStorage.getItem('xiaoche_enabled') === 'true';

const getDefaultVideoModel = () => isXiaocheVideoEnabled()
  ? 'xiaoche-veo-3.1-fast'
  : 'seedance-2.0';

const createTask = (): VideoTask => ({
  id: crypto.randomUUID(),
  createdAt: Date.now(),
  status: 'editing',
  videos: [],
  workspace: {
    mode: 'create', images: [], requirements: '', model: getDefaultVideoModel(), aspectRatio: '9:16', duration: 15, count: 1,
    stage: 1, schemes: [], selectedSchemeIds: [], keyframes: [], agentStatus: '输入准备 Agent · 等待素材', agentLog: ['已创建视频制作任务'],
  },
});

const parseJson = <T,>(value: string): T => JSON.parse(value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()) as T;

const parseSchemes = (value: string): CreativeScheme[] => {
  const parsed = parseJson<Array<Record<string, unknown>>>(value);
  if (!Array.isArray(parsed) || parsed.length < 1) throw new Error('创意 Agent 未返回有效方案，请重新生成');
  return parsed.slice(0, 3).map((item, index) => ({
    id: `scheme-${index + 1}`,
    title: String(item.title || `创意方案 ${index + 1}`),
    summary: String(item.summary || ''),
    strategy: String(item.strategy || ''),
    scenes: Array.isArray(item.scenes) ? (item.scenes as Array<Record<string, unknown>>).map((scene, sceneIndex) => ({
      time: String(scene.time || `镜头 ${sceneIndex + 1}`),
      visual: String(scene.visual || ''),
      audio: String(scene.audio || ''),
      overlay: String(scene.overlay || ''),
      prompt: String(scene.prompt || scene.visual || ''),
    })) : [],
  }));
};

const ProductVideoTab: React.FC<ProductVideoTabProps> = ({ isActive = true }) => {
  const initialTaskRef = useRef<VideoTask | null>(null);
  if (!initialTaskRef.current) initialTaskRef.current = createTask();
  const [tasks, setTasks] = useState<VideoTask[]>([initialTaskRef.current]);
  const [activeTaskId, setActiveTaskId] = useState(initialTaskRef.current.id);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [mode, setMode] = useState<CreationMode>('create');
  const [images, setImages] = useState<ProductAsset[]>([]);
  const [requirements, setRequirements] = useState('');
  const [model, setModel] = useState<string>(getDefaultVideoModel);
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [duration, setDuration] = useState(15);
  const [count, setCount] = useState(1);
  const [stage, setStage] = useState<Stage>(1);
  const [schemes, setSchemes] = useState<CreativeScheme[]>([]);
  const [selectedSchemeIds, setSelectedSchemeIds] = useState<string[]>([]);
  const [keyframes, setKeyframes] = useState<KeyframeResult[]>([]);
  const [agentStatus, setAgentStatus] = useState('输入准备 Agent · 等待素材');
  const [agentLog, setAgentLog] = useState<string[]>(['已创建视频制作任务']);
  const [videos, setVideos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyframePreview, setKeyframePreview] = useState<{ url: string; title: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xiaocheVideoEnabled = isXiaocheVideoEnabled();
  const videoVersions = xiaocheVideoEnabled ? XIAOCHE_VIDEO_VERSIONS : STANDARD_VIDEO_VERSIONS;

  useEffect(() => {
    if (!videoVersions.some((item) => item.id === model)) {
      setModel(videoVersions[0].id);
    }
  }, [model, videoVersions]);

  const updateTask = useCallback((patch: Partial<VideoTask>) => {
    setTasks((current) => current.map((task) => task.id === activeTaskId ? { ...task, ...patch } : task));
  }, [activeTaskId]);

  const currentWorkspace = (): VideoWorkspace => ({
    mode, images, requirements, model, aspectRatio, duration, count, stage, schemes, selectedSchemeIds, keyframes, agentStatus, agentLog,
  });

  const restoreWorkspace = (workspace: VideoWorkspace, taskVideos: string[]) => {
    setMode(workspace.mode);
    setImages(workspace.images);
    setRequirements(workspace.requirements);
    setModel(workspace.model);
    setAspectRatio(workspace.aspectRatio);
    setDuration(workspace.duration);
    setCount(workspace.count);
    setStage(workspace.stage);
    setSchemes(workspace.schemes);
    setSelectedSchemeIds(workspace.selectedSchemeIds);
    setKeyframes(workspace.keyframes);
    setAgentStatus(workspace.agentStatus);
    setAgentLog(workspace.agentLog);
    setVideos(taskVideos);
    setError(null);
  };

  const switchTask = (task: VideoTask) => {
    if (busy || task.id === activeTaskId) return;
    const snapshot = currentWorkspace();
    setTasks((current) => current.map((item) => item.id === activeTaskId ? { ...item, workspace: snapshot, videos, cover: images[0]?.preview || item.cover } : item));
    setActiveTaskId(task.id);
    restoreWorkspace(task.workspace, task.videos);
    if (window.innerWidth < 1280) setHistoryOpen(false);
  };

  const processFiles = useCallback(async (files: File[]) => {
    const accepted = files.filter((file) => file.type.startsWith('image/') && file.size <= MAX_FILE_SIZE).slice(0, MAX_IMAGES - images.length);
    if (!accepted.length) {
      setError(files.some((file) => file.size > MAX_FILE_SIZE) ? '单张图片不能超过 10MB' : `最多上传 ${MAX_IMAGES} 张参考图`);
      return;
    }
    try {
      const next = await Promise.all(accepted.map(async (file): Promise<ProductAsset> => {
        const compressed = await compressImage(file, 2048, 0.94);
        return { id: crypto.randomUUID(), name: file.name, mime: compressed.mime, base64: compressed.base64, preview: `data:${compressed.mime};base64,${compressed.base64}` };
      }));
      const merged = [...images, ...next].slice(0, MAX_IMAGES);
      setImages(merged);
      updateTask({ cover: merged[0]?.preview, status: 'editing' });
      setStage(1);
      setSchemes([]);
      setSelectedSchemeIds([]);
      setKeyframes([]);
      setVideos([]);
      setAgentStatus('输入准备 Agent · 已接收产品素材');
      setAgentLog((current) => [...current, `素材管理员已接收 ${merged.length} 张参考图`]);
      setError(null);
    } catch (uploadError) {
      setError(getErrorMessage(uploadError));
    }
  }, [images, updateTask]);

  useImagePaste((files) => void processFiles(files), isActive && !busy);

  const handleImageDrop = useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (busy) return;
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) void processFiles(files);
  }, [busy, processFiles]);

  const downloadKeyframe = useCallback(async (url: string, title: string) => {
    const filename = `${title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]+/g, '-') || 'storyboard'}-${Date.now()}.png`;
    let downloadUrl = url;
    let objectUrl: string | null = null;

    try {
      if (!url.startsWith('data:')) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Download failed (${response.status})`);
        objectUrl = URL.createObjectURL(await response.blob());
        downloadUrl = objectUrl;
      }
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }, []);

  const newTask = () => {
    if (busy) return;
    const task = createTask();
    const snapshot = currentWorkspace();
    setTasks((current) => [task, ...current.map((item) => item.id === activeTaskId ? { ...item, workspace: snapshot, videos, cover: images[0]?.preview || item.cover } : item)].slice(0, 20));
    setActiveTaskId(task.id);
    restoreWorkspace(task.workspace, []);
    if (window.innerWidth < 1280) setHistoryOpen(false);
  };

  const generatePlan = async () => {
    if (!images.length || !requirements.trim() || busy) return;
    setBusy(true);
    setError(null);
    updateTask({ status: 'planning' });
    setAgentStatus('创意策划 Agent · 正在分析产品与受众');
    setAgentLog((current) => [...current, '创意策划 Agent 开始分析产品视觉、卖点与视频目标']);
    try {
      const response = await generateText(images.map((image) => ({ base64: image.base64, mimeType: image.mime })), `
You are the lead creative strategy agent for an ecommerce product-video production team.
Analyze the uploaded product references as the only source of truth and create exactly 3 clearly differentiated, executable video concepts.
User request: ${requirements}
Mode: ${mode === 'create' ? 'original creation' : 'reference-style recreation'}
Duration: ${duration} seconds. Aspect ratio: ${aspectRatio}.
Each concept must preserve product identity and include 4-8 timed shots whose total fits the duration.
Return ONLY a JSON array. Each item: {"title":"short Chinese title","summary":"Chinese concept summary","strategy":"selling logic and audience insight","scenes":[{"time":"00:00-00:03","visual":"Chinese shot description","audio":"audio direction","overlay":"on-screen copy","prompt":"detailed English cinematic generation prompt"}]}.
No Markdown. No generic duplicate concepts.`);
      const nextSchemes = parseSchemes(response);
      setSchemes(nextSchemes);
      setSelectedSchemeIds([nextSchemes[0].id]);
      setStage(2);
      setAgentStatus('创意策划 Agent · 3 个方案已交付');
      setAgentLog((current) => [...current, `创意策划 Agent 已交付 ${nextSchemes.length} 个差异化方案，等待人工选择`]);
      updateTask({ status: 'ready' });
    } catch (planError) {
      setError(getErrorMessage(planError));
      updateTask({ status: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const generateKeyframes = async () => {
    const selected = schemes.filter((scheme) => selectedSchemeIds.includes(scheme.id));
    if (!selected.length || busy) return;
    setBusy(true);
    setStage(3);
    setError(null);
    updateTask({ status: 'planning' });
    setAgentStatus('分镜导演 Agent · 正在生成宫格关键帧');
    setAgentLog((current) => [...current, `分镜导演 Agent 接收 ${selected.length} 个方案，开始制作关键帧`]);
    try {
      const outputs: KeyframeResult[] = [];
      for (const scheme of selected) {
        const storyboardPrompt = `Create one clean 3x3 cinematic storyboard contact sheet for an ecommerce product video titled "${scheme.title}". User goal: ${requirements}. Story strategy: ${scheme.strategy}. Shots: ${scheme.scenes.map((scene, index) => `${index + 1}. ${scene.prompt || scene.visual}`).join(' ')}. The uploaded product images are the only product identity reference. Preserve exact product design, colors, patterns, logos and proportions in every panel. Nine distinct sequential shots, coherent lighting and character identity, no captions, no watermark, no extra products.`;
        const [firstKeyframe] = await generateImageToImage(images.map((image) => ({ base64: image.base64, mimeType: image.mime })), storyboardPrompt, { aspectRatio: aspectRatio === '9:16' ? AspectRatio.PORTRAIT_9_16 : aspectRatio === '1:1' ? AspectRatio.SQUARE : AspectRatio.LANDSCAPE_16_9, resolution: ImageResolution.RES_2K, modelId: 'gemini-3.1-flash-image-preview', workflowHint: 'scene-product-lock' });
        if (!firstKeyframe) throw new Error(`${scheme.title} 未生成关键帧`);
        setAgentStatus(`质量审查 Agent · 正在检查「${scheme.title}」`);
        const base64 = firstKeyframe.split(',')[1] || firstKeyframe;
        const qaRaw = await generateText([{ base64, mimeType: 'image/png' }], `You are a strict ecommerce storyboard QA agent. Review this 3x3 storyboard for product identity consistency, nine-panel completeness, shot diversity, visual continuity, and suitability for a ${duration}-second ${aspectRatio} product video. Return ONLY JSON: {"pass":true,"notes":"concise Chinese review","revisedPrompt":"if failed, concise English correction prompt"}.`);
        let qa: { pass?: boolean; notes?: string; revisedPrompt?: string } = {};
        try { qa = parseJson(qaRaw); } catch { qa = { pass: true, notes: '关键帧已完成基础结构检查' }; }
        let finalKeyframe = firstKeyframe;
        if (qa.pass === false && qa.revisedPrompt) {
          setAgentStatus(`分镜导演 Agent · 根据质检意见自动修正「${scheme.title}」`);
          const [revised] = await generateImageToImage(images.map((image) => ({ base64: image.base64, mimeType: image.mime })), `${storyboardPrompt}\nQA correction: ${qa.revisedPrompt}`, { aspectRatio: aspectRatio === '9:16' ? AspectRatio.PORTRAIT_9_16 : aspectRatio === '1:1' ? AspectRatio.SQUARE : AspectRatio.LANDSCAPE_16_9, resolution: ImageResolution.RES_2K, modelId: 'gemini-3.1-flash-image-preview', workflowHint: 'scene-product-lock' });
          if (revised) finalKeyframe = revised;
        }
        outputs.push({ schemeId: scheme.id, imageUrl: finalKeyframe, qaPassed: qa.pass !== false || finalKeyframe !== firstKeyframe, qaNotes: qa.notes || '质量审查完成' });
      }
      setKeyframes(outputs);
      setAgentStatus('质量审查 Agent · 关键帧已通过，可生成视频');
      setAgentLog((current) => [...current, `分镜导演生成 ${outputs.length} 张宫格关键帧`, '质量审查 Agent 已完成一致性与可执行性检查']);
      updateTask({ status: 'ready' });
    } catch (keyframeError) {
      setError(getErrorMessage(keyframeError));
      setAgentStatus('Agent 流程已暂停 · 请重试当前阶段');
      updateTask({ status: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const generateFinalVideo = async () => {
    const selected = schemes.filter((scheme) => selectedSchemeIds.includes(scheme.id));
    if (!selected.length || !keyframes.length || busy) return;
    setBusy(true);
    setStage(4);
    setError(null);
    updateTask({ status: 'generating' });
    setAgentStatus('视频制作 Agent · 正在调度视频模型');
    setAgentLog((current) => [...current, `视频制作 Agent 开始生成 ${selected.length * count} 条视频`]);
    try {
      const batches = await Promise.all(selected.map(async (scheme) => {
        const keyframe = keyframes.find((item) => item.schemeId === scheme.id);
        const prompt = [requirements, `Creative concept: ${scheme.title}. ${scheme.strategy}`, ...scheme.scenes.map((scene, index) => `Shot ${index + 1} (${scene.time}): ${scene.prompt || scene.visual}`), 'Preserve the exact product identity from all reference images and follow the approved storyboard contact sheet.'].join('\n');
        const result = await generateVideo(prompt, model, { aspectRatio, duration, count, resolution: '1080p', generateAudio: true, generationMode: 'CHARACTER_REF' }, keyframe?.imageUrl || images[0]?.preview, undefined, [keyframe?.imageUrl || '', ...images.map((image) => image.preview)].filter(Boolean));
        return result.uris?.length ? result.uris : [result.uri];
      }));
      const nextVideos = batches.flat();
      setVideos(nextVideos);
      setAgentStatus('交付 Agent · 视频已完成');
      setAgentLog((current) => [...current, `视频制作 Agent 已交付 ${nextVideos.length} 条视频`]);
      updateTask({ status: 'done', videos: nextVideos });
    } catch (videoError) {
      setError(getErrorMessage(videoError));
      setAgentStatus('视频制作 Agent · 任务失败，可从关键帧阶段重试');
      setAgentLog((current) => [...current, `视频制作 Agent 失败：${getErrorMessage(videoError)}`]);
      updateTask({ status: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = (status: TaskStatus) => ({ editing: '编辑中', planning: 'Agent 处理中', ready: '等待确认', generating: '生成视频中', done: '已完成', error: '需要重试' }[status]);

  return (
    <div className="no-scrollbar h-full min-h-0 overflow-x-hidden overflow-y-auto bg-[#f5f6f8] text-pastel-text dark:bg-[#080808]">
      <div className="mx-auto w-full max-w-[108rem] px-3 py-5 sm:px-5 lg:px-7">
        <header className="mb-6 text-center">
          <p className="flex items-center justify-center gap-2 text-xs font-bold text-pastel-muted"><Sparkles className="h-4 w-4 text-pastel-highlight" />AI 产品视频</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">AI生成产品展示视频</h1>
          <p className="mt-1 text-sm text-pastel-muted">上传素材，选择创作或复刻模式，批量生成展示类短视频</p>
          <div className="mt-5 flex items-center justify-center gap-2 text-xs font-bold text-pastel-muted sm:gap-4">
            {(['输入', '选择方案', '分镜图', '生成视频'] as const).map((label, index) => {
              const step = (index + 1) as Stage;
              return <React.Fragment key={label}><span className={`flex h-8 min-w-8 items-center justify-center rounded-full ${stage >= step ? 'bg-[#172238] text-white' : 'bg-pastel-card'}`}>{step}</span><span className={stage === step ? 'text-pastel-text' : ''}>{label}</span>{index < 3 && <span className="h-px w-3 bg-pastel-border sm:w-7" />}</React.Fragment>;
            })}
          </div>
        </header>

        {!historyOpen && <button type="button" onClick={() => setHistoryOpen(true)} className="fixed bottom-5 left-4 z-40 flex min-h-12 items-center gap-2 rounded-full border border-pastel-border bg-pastel-card px-4 text-sm font-black shadow-lg xl:left-24"><PanelLeftOpen className="h-4 w-4" />生成记录 <span className="rounded-full bg-pastel-bg px-2 py-1 text-xs">{tasks.length}</span></button>}
        {historyOpen && <button type="button" onClick={() => setHistoryOpen(false)} aria-label="关闭生成记录" className="fixed inset-0 z-[59] bg-black/30 xl:hidden" />}

        <div className={`grid grid-cols-1 gap-4 ${historyOpen ? 'xl:grid-cols-[16rem_30rem_minmax(0,1fr)]' : 'xl:grid-cols-[30rem_minmax(0,1fr)]'}`}>
          {historyOpen && (
            <aside className="no-scrollbar fixed inset-y-3 left-3 z-[60] flex w-[min(17rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-pastel-border bg-pastel-card p-3 shadow-xl xl:sticky xl:top-4 xl:z-10 xl:h-[calc(100vh-7rem)] xl:w-auto xl:shadow-sm">
              <div className="flex items-start justify-between"><div><h2 className="font-black">生成记录</h2><p className="text-xs text-pastel-muted">可同时开多个任务</p></div><button type="button" onClick={() => setHistoryOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-pastel-border"><ChevronLeft className="h-4 w-4" /></button></div>
              <button type="button" onClick={newTask} disabled={busy} className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#172238] text-sm font-black text-white disabled:opacity-50"><Plus className="h-4 w-4" />新开任务</button>
              <div className="no-scrollbar mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto">
                {tasks.map((task) => <button key={task.id} type="button" onClick={() => switchTask(task)} className={`block w-full overflow-hidden rounded-xl border text-left ${task.id === activeTaskId ? 'border-pastel-highlight ring-2 ring-orange-100' : 'border-pastel-border'}`}><div className="relative aspect-square bg-white">{task.cover ? <img src={task.cover} alt="任务预览" className="h-full w-full object-cover" /> : <ImageIcon className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 text-pastel-border" />}<span className="absolute inset-x-0 bottom-0 flex min-h-9 items-center justify-center gap-1 bg-[#172238]/90 text-xs font-black text-white">{task.status === 'planning' || task.status === 'generating' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}{statusLabel(task.status)}</span></div><div className="px-3 py-2 text-[0.7rem] text-pastel-muted">{new Date(task.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</div></button>)}
              </div>
            </aside>
          )}

          <div className="space-y-4">
            <section className="rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm">
              <h2 className="flex items-center gap-2 font-black"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#172238] text-sm text-white">1</span>生成模式</h2>
              <p className="mt-1 text-xs text-pastel-muted">根据参考图与你的要求自由创作批量视频</p>
              <div className="mt-4 grid grid-cols-2 rounded-xl bg-pastel-bg p-1"><button type="button" onClick={() => setMode('create')} className={`min-h-11 rounded-lg text-sm font-bold ${mode === 'create' ? 'bg-pastel-card shadow-sm' : 'text-pastel-muted'}`}><Layers3 className="mr-1 inline h-4 w-4" />创作模式</button><button type="button" onClick={() => setMode('replicate')} className={`min-h-11 rounded-lg text-sm font-bold ${mode === 'replicate' ? 'bg-pastel-card shadow-sm' : 'text-pastel-muted'}`}><Video className="mr-1 inline h-4 w-4" />复刻模式</button></div>
            </section>

            <section
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleImageDrop}
              className="rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600"><ImageIcon className="h-5 w-5" /></span><div><h2 className="font-black">参考图</h2><p className="text-xs text-pastel-muted">上传 1–3 张产品或场景图</p></div></div><span className="text-xs text-pastel-muted">{images.length}/3</span></div>
              {images.length === 0 ? <button type="button" onClick={() => fileInputRef.current?.click()} className="flex min-h-32 w-full flex-col items-center justify-center rounded-xl border border-dashed border-pastel-border"><Upload className="h-6 w-6 text-pastel-highlight" /><span className="mt-3 text-sm font-bold">拖拽、粘贴或点击选择文件</span><span className="mt-1 text-xs text-pastel-muted">JPG、JPEG、PNG、WEBP</span></button> : <div className="flex flex-wrap gap-2">{images.map((image, index) => <div key={image.id} className="group relative h-20 w-20 overflow-hidden rounded-xl border border-pastel-border bg-white"><img src={image.preview} alt={`参考图 ${index + 1}`} className="h-full w-full object-cover" /><button type="button" onClick={() => setImages((current) => current.filter((item) => item.id !== image.id))} className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-lg bg-black/55 text-white"><X className="h-4 w-4" /></button></div>)}{images.length < MAX_IMAGES && <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-pastel-border" aria-label="继续添加参考图"><Plus className="h-5 w-5" /></button>}</div>}
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => { void processFiles(Array.from(event.target.files || [])); event.target.value = ''; }} />
              <div className="mt-3 rounded-xl border border-pastel-border bg-pastel-bg/50 px-3 py-2 text-xs leading-5 text-pastel-muted">支持格式：JPG、JPEG、PNG、WEBP<br />图片大小不超过 10MB</div>
            </section>

            <section className="rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm"><h2 className="font-black">你的要求</h2><p className="mt-1 text-xs text-pastel-muted">填写产品卖点、适用场景、画面风格与展示重点</p><textarea value={requirements} onChange={(event) => setRequirements(event.target.value)} className="mt-3 min-h-36 w-full resize-y rounded-xl border border-pastel-border bg-pastel-bg p-3 text-sm outline-none focus:border-pastel-highlight" placeholder="例如：突出产品核心卖点，展示使用场景，风格清新自然，产品画面占比约 60%" /></section>

            <section className="rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm"><h2 className="font-black">视频参数</h2><div className="mt-4 grid grid-cols-2 gap-3"><label className="col-span-2 text-xs font-bold">版本<select value={model} onChange={(event) => setModel(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-sm font-bold">{videoVersions.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.hint}</option>)}</select></label><label className="text-xs font-bold">画面比例<select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-sm font-bold"><option>9:16</option><option>16:9</option><option>1:1</option></select></label><label className="text-xs font-bold">批量数量<select value={count} onChange={(event) => setCount(Number(event.target.value))} className="mt-2 min-h-11 w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-sm font-bold"><option value={1}>1 条</option><option value={2}>2 条</option><option value={3}>3 条</option><option value={4}>4 条</option></select></label><label className="col-span-2 text-xs font-bold">秒数<select value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="mt-2 min-h-11 w-full rounded-xl border border-pastel-border bg-pastel-bg px-3 text-sm font-bold"><option value={5}>5 秒</option><option value={8}>8 秒</option><option value={10}>10 秒</option><option value={15}>15 秒</option></select></label></div></section>
            <button type="button" onClick={generatePlan} disabled={!images.length || !requirements.trim() || busy} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#172238] px-4 text-base font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{busy && stage !== 4 ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}下一步：生成方案</button>
          </div>

          <section className="flex min-h-[42rem] flex-col rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm sm:p-5">
            <div><h2 className="flex items-center gap-2 font-black"><Sparkles className="h-4 w-4 text-pastel-highlight" />{stage === 1 ? '输入' : stage === 2 ? '选择方案' : stage === 3 ? '关键帧预览' : '生成视频'}</h2><p className="mt-1 text-xs text-pastel-muted">Agent 团队会依次完成策划、分镜、质检与视频制作</p></div>
            <details className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 p-3 dark:border-blue-500/20 dark:bg-blue-500/5" open={busy}>
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-black text-blue-800 dark:text-blue-200">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{agentStatus}</summary>
              <div className="mt-3 space-y-2 border-t border-blue-100 pt-3 text-xs text-blue-700/80 dark:border-blue-500/20 dark:text-blue-200/70">{agentLog.slice(-5).map((item, index) => <p key={`${item}-${index}`}>• {item}</p>)}</div>
            </details>
            {error && <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

            {stage === 1 && <div className="flex flex-1 flex-col items-center justify-center text-center text-pastel-muted"><Sparkles className="h-14 w-14 text-pastel-border" /><p className="mt-5 max-w-md text-sm">完成左侧输入后，创意策划 Agent 将分析产品并输出 3 个可执行方案</p></div>}

            {stage === 2 && <div className="mt-5 flex flex-1 flex-col"><div className="rounded-xl border border-pastel-border bg-pastel-bg/40 p-3 text-xs text-pastel-muted">创意方案可多选 · 共 {schemes.length} 条 · 已选 {selectedSchemeIds.length} 条</div><div className="mt-3 space-y-3">{schemes.map((scheme, index) => { const selected = selectedSchemeIds.includes(scheme.id); return <button key={scheme.id} type="button" onClick={() => setSelectedSchemeIds((current) => selected ? current.filter((id) => id !== scheme.id) : [...current, scheme.id])} className={`w-full rounded-2xl border p-4 text-left transition ${selected ? 'border-[#172238] bg-blue-50/40 ring-2 ring-blue-100' : 'border-pastel-border hover:border-blue-300'}`}><div className="flex items-start gap-3"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-black ${selected ? 'bg-[#172238] text-white' : 'bg-pastel-bg text-pastel-muted'}`}>{index + 1}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><h3 className="font-black">{scheme.title}</h3><span className={`flex h-6 w-6 items-center justify-center rounded-md border ${selected ? 'border-[#172238] bg-[#172238] text-white' : 'border-pastel-border'}`}>{selected && <CheckCircle2 className="h-4 w-4" />}</span></div><p className="mt-2 text-sm leading-6 text-pastel-muted">{scheme.summary}</p><p className="mt-2 text-xs font-bold text-blue-600">策略：{scheme.strategy}</p><p className="mt-2 line-clamp-2 text-xs text-pastel-muted">{scheme.scenes.map((scene) => scene.visual).join(' · ')}</p></div></div></button>; })}</div><button type="button" onClick={() => void generateKeyframes()} disabled={!selectedSchemeIds.length || busy} className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#172238] text-base font-black text-white disabled:opacity-40"><Clapperboard className="h-5 w-5" />下一步：Agent 生成宫格关键帧</button></div>}

            {stage === 3 && <div className="mt-5 flex flex-1 flex-col">{busy ? <div className="flex flex-1 flex-col items-center justify-center text-center"><Loader2 className="h-12 w-12 animate-spin text-pastel-highlight" /><p className="mt-5 font-black">Agent 正在制作并审查关键帧</p><p className="mt-2 max-w-md text-sm text-pastel-muted">分镜导演负责生成，质量审查 Agent 会检查产品一致性；不通过时自动修正一次</p></div> : <><div className="space-y-4">{keyframes.map((keyframe, index) => { const scheme = schemes.find((item) => item.id === keyframe.schemeId); const title = scheme?.title || `分镜图 ${index + 1}`; return <article key={keyframe.schemeId} className="overflow-hidden rounded-2xl border border-pastel-border"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-pastel-border px-4 py-3"><div><h3 className="font-black">{title}</h3><p className="text-xs text-pastel-muted">素材组 1 · 宫格关键帧</p></div><div className="flex items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-black ${keyframe.qaPassed ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{keyframe.qaPassed ? '质检通过' : '建议复核'}</span><button type="button" onClick={() => setKeyframePreview({ url: keyframe.imageUrl, title })} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-pastel-border text-pastel-muted transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600" aria-label={`放大查看 ${title}`}><Maximize2 className="h-4 w-4" /></button><button type="button" onClick={() => void downloadKeyframe(keyframe.imageUrl, title)} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-[#172238] text-white transition hover:bg-[#243554]" aria-label={`下载 ${title}`}><Download className="h-4 w-4" /></button></div></div><button type="button" onClick={() => setKeyframePreview({ url: keyframe.imageUrl, title })} className="group relative block w-full bg-[#10192b] p-4" aria-label={`放大查看 ${title}`}><img src={keyframe.imageUrl} alt={`${title} 宫格关键帧`} className="mx-auto max-h-[42rem] w-full object-contain transition duration-300 group-hover:scale-[1.01]" /><span className="pointer-events-none absolute bottom-7 right-7 flex items-center gap-2 rounded-full bg-black/65 px-3 py-2 text-xs font-black text-white opacity-0 backdrop-blur transition group-hover:opacity-100"><Maximize2 className="h-4 w-4" />点击放大</span></button><p className="border-t border-pastel-border px-4 py-3 text-xs text-pastel-muted">质量审查：{keyframe.qaNotes}</p></article>; })}</div><button type="button" onClick={() => void generateFinalVideo()} disabled={!keyframes.length} className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#172238] text-base font-black text-white disabled:opacity-40"><Film className="h-5 w-5" />开始生成产品视频</button></>}</div>}

            {stage === 4 && <div className="mt-5 flex flex-1 flex-col">{busy ? <div className="flex flex-1 flex-col items-center justify-center text-center"><Loader2 className="h-12 w-12 animate-spin text-pastel-highlight" /><p className="mt-5 font-black">视频制作 Agent 正在生成成片</p><p className="mt-2 text-sm text-pastel-muted">已锁定通过质检的关键帧、产品身份与镜头顺序</p></div> : videos.length ? <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{videos.map((uri, index) => <article key={uri} className="overflow-hidden rounded-2xl border border-pastel-border bg-black"><video src={uri} controls playsInline className="aspect-video w-full object-contain" /><div className="flex items-center justify-between bg-pastel-card p-3"><span className="text-sm font-black">产品视频 {index + 1}</span><a href={uri} download className="flex h-11 items-center gap-2 rounded-xl bg-[#172238] px-4 text-xs font-black text-white"><Download className="h-4 w-4" />下载</a></div></article>)}</div> : <div className="flex flex-1 flex-col items-center justify-center text-center text-pastel-muted"><Play className="h-12 w-12" /><p className="mt-4">Agent 流程已暂停，可返回关键帧阶段重试</p><button type="button" onClick={() => setStage(3)} className="mt-4 min-h-11 rounded-xl border border-pastel-border px-4 font-bold">返回关键帧</button></div>}</div>}
          </section>
        </div>

        {keyframePreview && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#07101f]/92 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label={`${keyframePreview.title} 放大预览`} onClick={() => setKeyframePreview(null)}>
            <div className="flex max-h-full w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#10192b] shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex min-h-14 items-center justify-between gap-3 border-b border-white/10 px-4 text-white sm:px-5"><div className="min-w-0"><h3 className="truncate text-sm font-black sm:text-base">{keyframePreview.title}</h3><p className="text-xs text-white/55">宫格关键帧 · 原图预览</p></div><div className="flex shrink-0 gap-2"><button type="button" onClick={() => void downloadKeyframe(keyframePreview.url, keyframePreview.title)} className="flex min-h-11 items-center gap-2 rounded-xl bg-orange-500 px-3 text-xs font-black text-white hover:bg-orange-600 sm:px-4"><Download className="h-4 w-4" /><span className="hidden sm:inline">下载原图</span></button><button type="button" onClick={() => setKeyframePreview(null)} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/15 text-white hover:bg-white/10" aria-label="关闭预览"><X className="h-5 w-5" /></button></div></div>
              <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-5"><img src={keyframePreview.url} alt={`${keyframePreview.title} 原图`} className="mx-auto max-h-[calc(100vh-8rem)] max-w-full object-contain" /></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductVideoTab;
