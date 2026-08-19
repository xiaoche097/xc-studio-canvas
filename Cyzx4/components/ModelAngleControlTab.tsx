import React, { useCallback, useRef, useState } from 'react';
import {
  AlertCircle,
  Aperture,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  Copy,
  Download,
  Eye,
  FileText,
  Focus,
  Image as ImageIcon,
  Loader2,
  Lock,
  Maximize2,
  PanelLeftOpen,
  Plus,
  RotateCcw,
  Sliders,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  User,
  X,
  ZoomIn,
} from 'lucide-react';
import {
  AngleSpec,
  CameraDistance,
  DEFAULT_ANGLE_SPEC,
  FramingType,
  GazeDirection,
  LUT_PRESETS,
  LutPreset,
  OFFICIAL_ANGLE_PRESETS,
  compileAnglePrompt,
} from '../services/anglePromptService';
import { compressImage, generateImageToImage } from '../services/geminiService';
import { useImagePaste } from '../hooks/useImagePaste';
import { getErrorMessage } from '../utils/apiHelpers';
import { saveGeneratedProject } from '../../services/projectHistoryService';
import { AspectRatio, ImageResolution } from '../types';
import { Virtual3DStudioCanvas } from './Virtual3DStudioCanvas';

type TaskStatus = 'editing' | 'generating' | 'done' | 'error';
type RightTabMode = 'camera' | 'pose' | 'compose';

interface AngleAsset {
  id: string;
  name: string;
  mime: string;
  base64: string;
  preview: string;
}

interface ShotItem {
  id: string;
  shotName: string;
  spec: AngleSpec;
  status: 'pending' | 'configured' | 'done';
  generatedUrl?: string;
}

interface AngleWorkspace {
  spec: AngleSpec;
  image?: AngleAsset;
  requirements: string;
  model: string;
  aspectRatio: string;
  resolution: string;
  generatedUrl?: string;
  agentStatus: string;
  agentLog: string[];
}

interface AngleTask {
  id: string;
  createdAt: number;
  status: TaskStatus;
  cover?: string;
  generatedUrl?: string;
  workspace: AngleWorkspace;
}

interface ModelAngleControlTabProps {
  isActive?: boolean;
}

const MAX_FILE_SIZE = 30 * 1024 * 1024;

const MODEL_OPTIONS = [
  { id: 'gemini-3.1-flash-image-preview', label: 'Gemini 3.1 Flash Image', hint: '推荐' },
  { id: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image', hint: '商业旗舰' },
  { id: 'gpt-image-2', label: 'GPT Image 2', hint: '逼真人像' },
  { id: 'qwen-image-3.0-pro', label: '千问 3.0 Pro', hint: '多图融合' },
] as const;

const ASPECT_RATIO_OPTIONS = [
  { id: '2:3', label: '2:3 竖版人像' },
  { id: '3:4', label: '3:4 电商主图' },
  { id: '1:1', label: '1:1 正方形' },
  { id: '9:16', label: '9:16 手机全屏' },
  { id: '16:9', label: '16:9 展板横图' },
] as const;

const CAMERA_DISTANCE_PRESETS = [
  { id: 'close_up', name: '特写 1.8m', dist: 1.8 },
  { id: 'near', name: '近景 2.5m', dist: 2.5 },
  { id: 'medium', name: '中景 3.5m', dist: 3.5 },
  { id: 'full_body', name: '全身 4.8m', dist: 4.8 },
  { id: 'wide', name: '远景 6.0m', dist: 6.0 },
];

const FOCAL_LENGTH_OPTIONS = [24, 35, 50, 85, 105, 135];
const APERTURE_OPTIONS = [1.4, 2.8, 4.0, 8.0, 11.0];
const ISO_OPTIONS = [100, 200, 400, 800, 1600];

const POSE_PRESETS = [
  { id: 'pose-standing', name: '自然站立', bodyYaw: 0, headYaw: 0, headPitch: 0 },
  { id: 'pose-relaxed', name: '松弛站姿', bodyYaw: 15, headYaw: -10, headPitch: 0 },
  { id: 'pose-turn-side', name: '优雅侧身', bodyYaw: 45, headYaw: -25, headPitch: 0 },
  { id: 'pose-lookback', name: '回眸一笑', bodyYaw: 135, headYaw: -45, headPitch: 0 },
  { id: 'pose-hand-waist', name: '单手扶腰', bodyYaw: -20, headYaw: 15, headPitch: 5 },
  { id: 'pose-editorial', name: 'Editorial大片', bodyYaw: 30, headYaw: 20, headPitch: -5 },
];

const createTask = (): AngleTask => ({
  id: crypto.randomUUID(),
  createdAt: Date.now(),
  status: 'editing',
  workspace: {
    spec: JSON.parse(JSON.stringify(DEFAULT_ANGLE_SPEC)),
    requirements: '',
    model: MODEL_OPTIONS[0].id,
    aspectRatio: '2:3',
    resolution: '2K',
    agentStatus: '3D 虚拟摄影棚 · 拖拽 3D 相机摆放视角',
    agentLog: ['已加载 3D 虚拟摄影棚'],
  },
});

export const ModelAngleControlTab: React.FC<ModelAngleControlTabProps> = ({ isActive = true }) => {
  const initialTaskRef = useRef<AngleTask | null>(null);
  if (!initialTaskRef.current) initialTaskRef.current = createTask();

  const [tasks, setTasks] = useState<AngleTask[]>([initialTaskRef.current]);
  const [activeTaskId, setActiveTaskId] = useState<string>(initialTaskRef.current.id);
  const [historyOpen, setHistoryOpen] = useState(true);

  // Active Right Control Tab Mode
  const [rightTab, setRightTab] = useState<RightTabMode>('camera');

  // Shot Filmstrip list (Shot 01 ~ Shot 09)
  const [shots, setShots] = useState<ShotItem[]>([
    { id: 'shot-1', shotName: 'Shot 01', spec: JSON.parse(JSON.stringify(DEFAULT_ANGLE_SPEC)), status: 'configured' },
    { id: 'shot-2', shotName: 'Shot 02', spec: { ...DEFAULT_ANGLE_SPEC, camera: { ...DEFAULT_ANGLE_SPEC.camera, azimuth: 45 } }, status: 'pending' },
    { id: 'shot-3', shotName: 'Shot 03', spec: { ...DEFAULT_ANGLE_SPEC, camera: { ...DEFAULT_ANGLE_SPEC.camera, azimuth: -45 } }, status: 'pending' },
  ]);
  const [activeShotId, setActiveShotId] = useState<string>('shot-1');

  // Active Workspace States
  const [image, setImage] = useState<AngleAsset | undefined>(undefined);
  const [spec, setSpec] = useState<AngleSpec>(JSON.parse(JSON.stringify(DEFAULT_ANGLE_SPEC)));
  const [requirements, setRequirements] = useState('');
  const [model, setModel] = useState<string>(MODEL_OPTIONS[0].id);
  const [aspectRatio, setAspectRatio] = useState('2:3');
  const [resolution, setResolution] = useState('2K');
  const [generatedUrl, setGeneratedUrl] = useState<string | undefined>(undefined);

  const [agentStatus, setAgentStatus] = useState('3D 虚拟摄影棚 · 看取景器全景掌控拍摄');
  const [agentLog, setAgentLog] = useState<string[]>(['已建立 3D 摄影空间']);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promptFolded, setPromptFolded] = useState(true);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ url: string; title: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateTask = useCallback(
    (patch: Partial<AngleTask>) => {
      setTasks((current) => current.map((t) => (t.id === activeTaskId ? { ...t, ...patch } : t)));
    },
    [activeTaskId]
  );

  const currentWorkspace = (): AngleWorkspace => ({
    spec,
    image,
    requirements,
    model,
    aspectRatio,
    resolution,
    generatedUrl,
    agentStatus,
    agentLog,
  });

  const restoreWorkspace = (workspace: AngleWorkspace) => {
    setSpec(workspace.spec || JSON.parse(JSON.stringify(DEFAULT_ANGLE_SPEC)));
    setImage(workspace.image);
    setRequirements(workspace.requirements || '');
    setModel(workspace.model || MODEL_OPTIONS[0].id);
    setAspectRatio(workspace.aspectRatio || '2:3');
    setResolution(workspace.resolution || '2K');
    setGeneratedUrl(workspace.generatedUrl);
    setAgentStatus(workspace.agentStatus || '准备就绪');
    setAgentLog(workspace.agentLog || []);
    setError(null);
  };

  const switchTask = (task: AngleTask) => {
    if (busy || task.id === activeTaskId) return;
    const snapshot = currentWorkspace();
    setTasks((current) =>
      current.map((item) =>
        item.id === activeTaskId
          ? { ...item, workspace: snapshot, cover: image?.preview || item.cover, generatedUrl }
          : item
      )
    );
    setActiveTaskId(task.id);
    restoreWorkspace(task.workspace);
    if (window.innerWidth < 1280) setHistoryOpen(false);
  };

  const deleteTask = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (busy && id === activeTaskId) return;
    setTasks((current) => {
      if (current.length <= 1) {
        const freshTask = createTask();
        setActiveTaskId(freshTask.id);
        restoreWorkspace(freshTask.workspace);
        return [freshTask];
      }
      const remaining = current.filter((t) => t.id !== id);
      if (id === activeTaskId) {
        const nextTask = remaining[0];
        setActiveTaskId(nextTask.id);
        restoreWorkspace(nextTask.workspace);
      }
      return remaining;
    });
  };

  const newTask = () => {
    if (busy) return;
    const task = createTask();
    const snapshot = currentWorkspace();
    setTasks((current) =>
      [
        task,
        ...current.map((item) =>
          item.id === activeTaskId
            ? { ...item, workspace: snapshot, cover: image?.preview || item.cover, generatedUrl }
            : item
        ),
      ].slice(0, 20)
    );
    setActiveTaskId(task.id);
    restoreWorkspace(task.workspace);
    if (window.innerWidth < 1280) setHistoryOpen(false);
  };

  const processFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        setError('请上传标准的图片文件（JPG, PNG, WEBP）');
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError('单张图片不能超过 30MB');
        return;
      }
      try {
        const compressed = await compressImage(file, 2048, 0.94);
        const asset: AngleAsset = {
          id: crypto.randomUUID(),
          name: file.name,
          mime: compressed.mime,
          base64: compressed.base64,
          preview: `data:${compressed.mime};base64,${compressed.base64}`,
        };
        setImage(asset);
        updateTask({ cover: asset.preview, status: 'editing' });
        setAgentStatus('3D 虚拟摄影棚 · 已装载模特原图，在 3D 场景中调角取景');
        setAgentLog((current) => [...current, `已装载参考图「${file.name}」，四重锁定后台使能`]);
        setError(null);
      } catch (uploadErr) {
        setError(getErrorMessage(uploadErr));
      }
    },
    [updateTask]
  );

  useImagePaste((files) => {
    if (files.length > 0) void processFile(files[0]);
  }, isActive && !busy);

  const compiledPromptText = compileAnglePrompt(spec, requirements);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(compiledPromptText).then(() => {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    });
  };

  const handleApplyPreset = (presetSpec: Partial<AngleSpec>) => {
    setSpec((prev) => ({
      ...prev,
      camera: { ...prev.camera, ...(presetSpec.camera || {}) },
      subject: { ...prev.subject, ...(presetSpec.subject || {}) },
      composition: { ...prev.composition, ...(presetSpec.composition || {}) },
    }));
  };

  const handleLookAtCamera = () => {
    const targetHeadYaw = -spec.camera.azimuth;
    setSpec((prev) => ({
      ...prev,
      subject: {
        ...prev.subject,
        headYaw: Math.round(targetHeadYaw),
        headPitch: 0,
        gaze: 'camera',
      },
    }));
    setAgentLog((current) => [...current, '已点击 Look At Camera，头部与眼神已自动对准镜头']);
  };

  const handleDeleteShot = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (shots.length <= 1) return;
    setShots((prev) => {
      const nextShots = prev.filter((s) => s.id !== id);
      if (activeShotId === id && nextShots.length > 0) {
        setActiveShotId(nextShots[0].id);
        setSpec(nextShots[0].spec);
      }
      return nextShots;
    });
  };

  const handleSelectFocalLength = (fl: number) => {
    let defaultDist = 3.2;
    if (fl === 24) defaultDist = 4.8;
    else if (fl === 35) defaultDist = 4.0;
    else if (fl === 50) defaultDist = 3.2;
    else if (fl === 85) defaultDist = 2.2;
    else if (fl === 105) defaultDist = 1.8;
    else if (fl === 135) defaultDist = 1.5;

    setSpec((prev) => ({
      ...prev,
      camera: {
        ...prev.camera,
        focalLength: fl,
        distanceNum: defaultDist,
      },
    }));
  };

  const handleAddShot = () => {
    if (shots.length >= 9) return;
    const newIndex = shots.length + 1;
    const newShotItem: ShotItem = {
      id: `shot-${Date.now()}`,
      shotName: `Shot 0${newIndex}`,
      spec: JSON.parse(JSON.stringify(spec)),
      status: 'configured',
    };
    setShots((prev) => [...prev, newShotItem]);
    setActiveShotId(newShotItem.id);
  };

  const handleCopyCurrentShot = () => {
    if (shots.length >= 9) return;
    const newIndex = shots.length + 1;
    const copyItem: ShotItem = {
      id: `shot-${Date.now()}`,
      shotName: `Shot 0${newIndex} (副本)`,
      spec: JSON.parse(JSON.stringify(spec)),
      status: 'configured',
    };
    setShots((prev) => [...prev, copyItem]);
    setActiveShotId(copyItem.id);
  };

  const handleGenerate = async () => {
    if (!image || busy) return;
    setBusy(true);
    setError(null);
    updateTask({ status: 'generating' });
    setAgentStatus('3D 虚拟摄影 Agent · 正在按照 3D 视口相机机位渲染高精大图...');
    setAgentLog((current) => [
      ...current,
      `方位角 ${spec.camera.azimuth}°，仰俯 ${spec.camera.elevation}°，距离 ${spec.camera.distanceNum || 3.5}m，焦段 ${spec.camera.focalLength}mm`,
      `Prompt Compiler 转译中...`,
    ]);

    try {
      const targetRatioEnum =
        aspectRatio === '2:3'
          ? AspectRatio.PORTRAIT_2_3
          : aspectRatio === '9:16'
          ? AspectRatio.PORTRAIT_9_16
          : aspectRatio === '3:4'
          ? AspectRatio.PORTRAIT_3_4
          : aspectRatio === '1:1'
          ? AspectRatio.SQUARE
          : AspectRatio.LANDSCAPE_16_9;

      const [resultUrl] = await generateImageToImage(
        [{ base64: image.base64, mimeType: image.mime }],
        compiledPromptText,
        {
          aspectRatio: targetRatioEnum,
          resolution: ImageResolution.RES_2K,
          modelId: model,
          workflowHint: 'scene-product-lock',
        }
      );

      if (!resultUrl) throw new Error('生成图片失败，AI 模型未返回有效结果');

      setGeneratedUrl(resultUrl);
      setAgentStatus('交付 Agent · 当前镜头视角图片已精准交付！');
      setAgentLog((current) => [...current, '渲染成功，已保存至任务列表']);
      updateTask({ status: 'done', generatedUrl: resultUrl });

      setShots((prev) =>
        prev.map((s) => (s.id === activeShotId ? { ...s, status: 'done', generatedUrl: resultUrl } : s))
      );

      void saveGeneratedProject({
        type: 'MODEL_ANGLE_CONTROL',
        generated: [resultUrl],
        original: [image.preview],
        prompt: compiledPromptText,
        thumbnail: resultUrl,
      });
    } catch (genErr) {
      setError(getErrorMessage(genErr));
      setAgentStatus('3D 虚拟摄影 Agent · 遇到错误，请调整机位重试');
      updateTask({ status: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = (status: TaskStatus) =>
    ({ editing: '编辑中', generating: '渲染中', done: '已完成', error: '重试' }[status]);

  return (
    <div className="no-scrollbar h-full min-h-0 overflow-x-hidden overflow-y-auto bg-[#f8fafc] text-slate-800 font-sans">
      <div className="mx-auto w-full max-w-[112rem] px-4 py-4 sm:px-6 lg:px-8">
        {/* HEADER BAR */}
        <header className="mb-4 flex items-center justify-between border-b border-slate-200/80 pb-3 bg-white px-5 py-3 rounded-2xl shadow-xs">
          <div>
            <span className="text-[0.72rem] font-bold text-slate-400">创作中心 &gt; 模特角度控制</span>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2 mt-0.5">
              <Camera className="h-5 w-5 text-[#ed6d46]" /> 模特角度控制 V2.1 (3D 虚拟摄影棚)
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-400">
              精准解耦控制 3D 相机机位、焦段透视、距离、专业参数与预设 LUT
            </span>
            {!historyOpen && (
              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
              >
                <PanelLeftOpen className="h-4 w-4 text-[#ed6d46]" /> 生成记录 ({tasks.length})
              </button>
            )}
          </div>
        </header>

        {/* MAIN THREE-COLUMN LAYOUT */}
        <div
          className={`grid grid-cols-1 gap-5 ${
            historyOpen ? 'xl:grid-cols-[16rem_minmax(0,1fr)_27rem]' : 'xl:grid-cols-[18rem_minmax(0,1fr)_27rem]'
          }`}
        >
          {/* LEFT SIDEBAR */}
          <aside className="space-y-4">
            {/* REFERENCE IMAGE CARD */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <ImageIcon className="h-4 w-4 text-[#ed6d46]" /> 模特/产品参考图
                </h2>
              </div>

              {!image ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex min-h-36 w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 hover:border-[#ed6d46] transition bg-slate-50/50 p-4 text-center"
                >
                  <Upload className="h-6 w-6 text-[#ed6d46]" />
                  <span className="mt-2 text-xs font-bold text-slate-800">上传参考模特图</span>
                  <span className="mt-0.5 text-[0.65rem] text-slate-400">JPG, PNG, WEBP · 支持拖拽/粘贴</span>
                </button>
              ) : (
                <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
                  <img src={image.preview} alt="参考原图" className="h-44 w-full object-contain" />
                  <button
                    type="button"
                    onClick={() => setImage(undefined)}
                    className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white hover:bg-red-500 transition"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) void processFile(e.target.files[0]);
                  e.target.value = '';
                }}
              />

              {/* REFERENCE LOCK 4 MINIMAL BADGES */}
              <div className="mt-3 pt-3 border-t border-slate-100">
                <span className="block text-[0.65rem] font-black text-slate-400 mb-1.5">REFERENCE LOCK (四重锁定)</span>
                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[0.65rem] font-bold text-slate-700">
                    MODEL <Lock className="h-2.5 w-2.5 text-[#ed6d46]" />
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[0.65rem] font-bold text-slate-700">
                    OUTFIT <Lock className="h-2.5 w-2.5 text-[#ed6d46]" />
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[0.65rem] font-bold text-slate-700">
                    SCENE <Lock className="h-2.5 w-2.5 text-[#ed6d46]" />
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[0.65rem] font-bold text-slate-700">
                    LIGHT <Lock className="h-2.5 w-2.5 text-[#ed6d46]" />
                  </span>
                </div>
              </div>
            </div>

            {/* TASK HISTORY SIDEBAR */}
            {historyOpen && (
              <div className="no-scrollbar rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs flex flex-col max-h-[calc(100vh-22rem)]">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div>
                    <h2 className="text-xs font-black text-slate-900">生成记录</h2>
                    <p className="text-[0.62rem] text-slate-400">视角任务历史列表</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHistoryOpen(false)}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:text-slate-700"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={newTask}
                  disabled={busy}
                  className="mt-2.5 flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-[#172238] text-xs font-black text-white hover:bg-slate-800 disabled:opacity-50 transition"
                >
                  <Plus className="h-3.5 w-3.5" /> 新建任务
                </button>

                <div className="no-scrollbar mt-2.5 min-h-0 flex-1 space-y-2 overflow-y-auto">
                  {tasks.map((task) => (
                    <div key={task.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => switchTask(task)}
                        className={`block w-full overflow-hidden rounded-xl border text-left transition ${
                          task.id === activeTaskId
                            ? 'border-[#ed6d46] ring-1 ring-orange-200'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="relative aspect-square bg-slate-900">
                          {task.generatedUrl || task.cover ? (
                            <img
                              src={task.generatedUrl || task.cover}
                              alt="任务缩略"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-slate-600" />
                          )}
                          <span className="absolute inset-x-0 bottom-0 flex min-h-6 items-center justify-center gap-1 bg-black/75 text-[0.62rem] font-bold text-white">
                            {task.status === 'generating' ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                            {statusLabel(task.status)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between px-2 py-1 text-[0.62rem] text-slate-400 bg-slate-50">
                          <span>
                            {new Date(task.createdAt).toLocaleTimeString('zh-CN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span className="font-mono font-bold text-[#ed6d46]">Azimuth {task.workspace.spec.camera.azimuth}°</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => deleteTask(task.id, e)}
                        disabled={busy && task.id === activeTaskId}
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white opacity-0 transition hover:bg-red-500 group-hover:opacity-100 disabled:opacity-30"
                        title="删除任务"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* CENTER HERO SECTION: 3D VIRTUAL STUDIO & SHOT FILMSTRIP */}
          <main className="flex flex-col gap-4 min-w-0">
            {/* 3D VIRTUAL STUDIO CANVAS */}
            <div className="relative flex-1 min-h-[34rem] rounded-2xl border border-slate-200/80 bg-white p-2 shadow-xs overflow-hidden">
              <Virtual3DStudioCanvas
                spec={spec}
                onChangeSpec={(updater) => setSpec((prev) => updater(prev))}
              />
            </div>

            {/* BOTTOM SHOT FILMSTRIP */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <Camera className="h-4 w-4 text-[#ed6d46]" /> 镜头胶卷卡片 (Shot Filmstrip)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyCurrentShot}
                    disabled={shots.length >= 9}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition"
                  >
                    复制当前 Shot 视角
                  </button>
                  <button
                    type="button"
                    onClick={handleAddShot}
                    disabled={shots.length >= 9}
                    className="flex items-center gap-1 rounded-lg bg-[#172238] px-2.5 py-1 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-40 transition"
                  >
                    <Plus className="h-3.5 w-3.5" /> 添加 Shot
                  </button>
                </div>
              </div>

              <div className="no-scrollbar flex items-center gap-3 overflow-x-auto py-1">
                {shots.map((shot) => {
                  const isActive = shot.id === activeShotId;
                  return (
                    <div key={shot.id} className="group relative shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveShotId(shot.id);
                          setSpec(shot.spec);
                        }}
                        className={`relative min-w-32 flex-col rounded-xl border p-2.5 text-left transition ${
                          isActive
                            ? 'border-[#ed6d46] bg-orange-50/50 ring-2 ring-orange-200'
                            : 'border-slate-200 bg-slate-50/80 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-black text-slate-900 pr-3">
                          <span className="truncate">{shot.shotName}</span>
                          {shot.status === 'done' ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          ) : (
                            <span className="text-[0.6rem] font-bold text-slate-400 font-mono shrink-0">
                              {shot.spec.camera.azimuth}°
                            </span>
                          )}
                        </div>
                        <span className="block mt-1 text-[0.62rem] text-slate-500 font-mono truncate">
                          {shot.spec.camera.focalLength}mm | Dist: {shot.spec.camera.distanceNum || 3.5}m
                        </span>
                      </button>

                      {shots.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteShot(shot.id, e)}
                          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-white opacity-0 transition hover:bg-red-500 group-hover:opacity-100 shadow-xs"
                          title="删除当前 Shot"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </main>

          {/* RIGHT COLUMN: CONTROLS & RENDER RESULTS */}
          <section className="flex flex-col gap-4">
            {/* THREE TABS CONTROLS: CAMERA | POSE | COMPOSE */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
              {/* Tab Header Navigation */}
              <div className="flex rounded-xl bg-slate-100 p-1 mb-3">
                <button
                  type="button"
                  onClick={() => setRightTab('camera')}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-black transition ${
                    rightTab === 'camera'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  CAMERA (相机参数)
                </button>
                <button
                  type="button"
                  onClick={() => setRightTab('pose')}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-black transition ${
                    rightTab === 'pose'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  POSE (姿态)
                </button>
                <button
                  type="button"
                  onClick={() => setRightTab('compose')}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-black transition ${
                    rightTab === 'compose'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  COMPOSE (构图)
                </button>
              </div>

              {/* CAMERA TAB WITH DISTANCE, FOCAL LENGTH, APERTURE, ISO, LUT */}
              {rightTab === 'camera' && (
                <div className="space-y-4">
                  {/* 1. CAMERA DISTANCE (拉近拉远 - PRD Feature 2) */}
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span>Camera Distance (摄影距离 / 拉近拉远)</span>
                      <span className="text-[#ed6d46] font-mono">{spec.camera.distanceNum || 3.5}m</span>
                    </div>
                    <input
                      type="range"
                      min="1.5"
                      max="7.0"
                      step="0.1"
                      value={spec.camera.distanceNum || 3.5}
                      onChange={(e) =>
                        setSpec((prev) => ({
                          ...prev,
                          camera: { ...prev.camera, distanceNum: Number(e.target.value) },
                        }))
                      }
                      className="w-full accent-[#ed6d46] cursor-pointer"
                    />
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {CAMERA_DISTANCE_PRESETS.map((dp) => (
                        <button
                          key={dp.id}
                          type="button"
                          onClick={() => setSpec((prev) => ({ ...prev, camera: { ...prev.camera, distanceNum: dp.dist } }))}
                          className={`rounded-lg px-2 py-1 text-[0.65rem] font-bold transition ${
                            spec.camera.distanceNum === dp.dist
                              ? 'bg-[#172238] text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {dp.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2. FOCAL LENGTH (镜头焦段 - PRD Feature 1) */}
                  <div>
                    <span className="block text-[0.68rem] font-black text-slate-400 mb-1.5">Focal Length (镜头焦段)</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {FOCAL_LENGTH_OPTIONS.map((fl) => (
                        <button
                          key={fl}
                          type="button"
                          onClick={() => handleSelectFocalLength(fl)}
                          className={`rounded-lg py-1.5 text-xs font-bold transition ${
                            spec.camera.focalLength === fl
                              ? 'bg-[#ed6d46] text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {fl}mm
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3. PROFESSIONAL CAMERA PARAMETERS (PRD Feature 3) */}
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 space-y-3">
                    <span className="block text-[0.65rem] font-black text-slate-500 uppercase tracking-wider">
                      专业摄影机曝光与景深参数
                    </span>

                    {/* APERTURE */}
                    <div>
                      <div className="flex justify-between text-[0.7rem] font-bold mb-1">
                        <span>Aperture 光圈 (决定背景虚化 Bokeh)</span>
                        <span className="text-[#ed6d46] font-mono">f/{spec.camera.aperture || 2.8}</span>
                      </div>
                      <div className="flex gap-1">
                        {APERTURE_OPTIONS.map((ap) => (
                          <button
                            key={ap}
                            type="button"
                            onClick={() => setSpec((prev) => ({ ...prev, camera: { ...prev.camera, aperture: ap } }))}
                            className={`flex-1 rounded-md py-1 text-[0.65rem] font-bold transition ${
                              spec.camera.aperture === ap
                                ? 'bg-[#172238] text-white'
                                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                            }`}
                          >
                            f/{ap}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ISO */}
                    <div>
                      <div className="flex justify-between text-[0.7rem] font-bold mb-1">
                        <span>ISO 感光度</span>
                        <span className="text-slate-600 font-mono">ISO {spec.camera.iso || 100}</span>
                      </div>
                      <div className="flex gap-1">
                        {ISO_OPTIONS.map((isoVal) => (
                          <button
                            key={isoVal}
                            type="button"
                            onClick={() => setSpec((prev) => ({ ...prev, camera: { ...prev.camera, iso: isoVal } }))}
                            className={`flex-1 rounded-md py-1 text-[0.65rem] font-bold transition ${
                              spec.camera.iso === isoVal
                                ? 'bg-[#172238] text-white'
                                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                            }`}
                          >
                            {isoVal}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 4. PRESET LUT COLOR GRADING (PRD Feature 4) */}
                  <div>
                    <span className="block text-[0.68rem] font-black text-slate-400 mb-1.5">胶片与 LUT 预设色调库</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {LUT_PRESETS.map((lut) => (
                        <button
                          key={lut.id}
                          type="button"
                          onClick={() => setSpec((prev) => ({ ...prev, camera: { ...prev.camera, lutPreset: lut.id } }))}
                          className={`rounded-xl border p-2 text-left transition ${
                            spec.camera.lutPreset === lut.id
                              ? 'border-[#ed6d46] bg-orange-50 text-slate-900 ring-1 ring-orange-200'
                              : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <strong className="block text-xs font-black truncate">{lut.name}</strong>
                          <span className="block text-[0.6rem] text-slate-400 truncate">{lut.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* POSE TAB */}
              {rightTab === 'pose' && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleLookAtCamera}
                    className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-orange-50 border border-orange-200 text-xs font-black text-[#ed6d46] hover:bg-orange-100 transition"
                  >
                    ◎ LOOK AT CAMERA (头部眼神回看镜头)
                  </button>

                  <div>
                    <span className="block text-[0.68rem] font-black text-slate-400 mb-1.5">姿势预设 (Pose Presets)</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {POSE_PRESETS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() =>
                            setSpec((prev) => ({
                              ...prev,
                              subject: {
                                ...prev.subject,
                                bodyYaw: p.bodyYaw,
                                headYaw: p.headYaw,
                                headPitch: p.headPitch,
                              },
                            }))
                          }
                          className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-left hover:border-[#ed6d46] transition"
                        >
                          <strong className="block text-xs font-bold text-slate-800">{p.name}</strong>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* COMPOSE TAB */}
              {rightTab === 'compose' && (
                <div className="space-y-3">
                  <div>
                    <span className="block text-[0.68rem] font-black text-slate-400 mb-1.5">画面裁切 (Framing)</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'face', label: '面部特写' },
                        { id: 'chest', label: '胸部以上' },
                        { id: 'mid_thigh', label: '大腿中部' },
                        { id: 'full_body', label: '全身完整' },
                      ].map((fr) => (
                        <button
                          key={fr.id}
                          type="button"
                          onClick={() =>
                            setSpec((prev) => ({
                              ...prev,
                              composition: { ...prev.composition, framing: fr.id as FramingType },
                            }))
                          }
                          className={`rounded-xl border p-2 text-xs font-bold text-left transition ${
                            spec.composition.framing === fr.id
                              ? 'border-[#ed6d46] bg-orange-50 text-[#ed6d46]'
                              : 'border-slate-200 bg-slate-50 text-slate-700'
                          }`}
                        >
                          {fr.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* GENERATION PARAMETERS & ACTION BUTTON */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="block text-[0.65rem] font-bold text-slate-400 mb-1">生成模型</span>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-bold text-slate-800 outline-none"
                  >
                    {MODEL_OPTIONS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="block text-[0.65rem] font-bold text-slate-400 mb-1">画幅比例</span>
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-bold text-slate-800 outline-none"
                  >
                    {ASPECT_RATIO_OPTIONS.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={!image || busy}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#172238] text-sm font-black text-white hover:bg-slate-800 disabled:opacity-40 transition shadow-md"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-[#ed6d46]" />}
                🚀 生成当前镜头视角大图
              </button>
            </div>

            {/* RENDER RESULT DISPLAY CARD */}
            <div className="flex-1 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-900 flex items-center justify-between">
                  <span>视角渲染交付结果</span>
                  {generatedUrl && <span className="text-[#ed6d46] font-mono">Azimuth {spec.camera.azimuth}°</span>}
                </h3>

                {busy && (
                  <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin shrink-0 text-[#ed6d46]" />
                    <span>{agentStatus}</span>
                  </div>
                )}
                {error && (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {generatedUrl && image ? (
                  <div className="mt-3 space-y-3">
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
                      <img src={generatedUrl} alt="渲染图" className="h-52 w-full object-contain" />
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setImagePreview({ url: generatedUrl, title: `模特角度 - Azimuth ${spec.camera.azimuth}°` })}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                      >
                        <Maximize2 className="h-3.5 w-3.5" /> 大图
                      </button>
                      <a
                        href={generatedUrl}
                        download={`model-angle-${spec.camera.azimuth}deg.png`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded-lg bg-[#172238] px-3.5 py-1.5 text-xs font-black text-white hover:bg-slate-800"
                      >
                        <Download className="h-3.5 w-3.5" /> 下载
                      </a>
                    </div>
                  </div>
                ) : (
                  !busy && (
                    <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
                      <Camera className="h-9 w-9 text-slate-300 mb-2" />
                      <p className="text-xs font-bold text-slate-600">在 3D 摄影棚调整机位后点击生成</p>
                    </div>
                  )
                )}
              </div>

              {/* COLLAPSIBLE PROMPT PREVIEW */}
              <div className="mt-3 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setPromptFolded(!promptFolded)}
                  className="flex w-full items-center justify-between text-[0.68rem] font-bold text-slate-400 hover:text-slate-700"
                >
                  <span className="flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5 text-[#ed6d46]" /> 实时 AngleSpec 编译 Prompt
                  </span>
                  <span>{promptFolded ? '展开 ▸' : '收起 ▾'}</span>
                </button>

                {!promptFolded && (
                  <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                    <div className="flex items-center justify-between mb-1 pb-1 border-b border-slate-200/60">
                      <span className="text-[0.62rem] text-[#ed6d46] font-bold">Compiled Prompt</span>
                      <button
                        type="button"
                        onClick={handleCopyPrompt}
                        className="flex items-center gap-1 text-[0.65rem] text-slate-600 hover:text-slate-900"
                      >
                        {copiedPrompt ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        {copiedPrompt ? '已复制' : '复制'}
                      </button>
                    </div>
                    <pre className="whitespace-pre-wrap select-all font-mono text-[0.62rem] leading-4 text-slate-600 max-h-28 overflow-y-auto no-scrollbar">
                      {compiledPromptText}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* LIGHTBOX PREVIEW MODAL */}
        {imagePreview && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            onClick={() => setImagePreview(null)}
          >
            <div
              className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-slate-900 text-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex min-h-12 items-center justify-between px-5 border-b border-white/10">
                <h3 className="text-sm font-black">{imagePreview.title}</h3>
                <button
                  type="button"
                  onClick={() => setImagePreview(null)}
                  className="rounded-lg p-1 hover:bg-white/10"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-4 flex-1 overflow-auto">
                <img src={imagePreview.url} alt="预览大图" className="mx-auto max-h-[80vh] object-contain" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelAngleControlTab;
