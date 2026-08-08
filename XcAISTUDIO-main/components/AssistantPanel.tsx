import React, { useRef, useEffect, useMemo, useState } from 'react';
import { 
  X, Eraser, Copy, CornerDownLeft, Loader2, Sparkles, Brain, PenLine, Wand2,
  Shirt, Palette, Award, Home, MessageSquare, Clapperboard, Megaphone, ScanFace, Zap,
  Clock, Plus, AtSign, FileText, Globe, ArrowUp, ChevronDown, ChevronRight, RotateCcw,
  ArrowLeftRight, Camera, Crop, Expand, Film, ImagePlus, Layers3, PackageCheck, Paintbrush,
  ScanSearch, Scissors, Store, UserRoundCog, Check, Send, LayoutTemplate, BookOpen, MessageSquareQuote,
  SlidersHorizontal, CheckCircle2, Circle, Settings2, Upload, ListChecks, ShieldCheck, AlertCircle,
  ThumbsUp, ThumbsDown, LocateFixed, Quote, Trash2, MessageSquarePlus, RefreshCw
} from 'lucide-react';
import { sendChatMessageStream } from '../services/geminiService';
import { XIAOCHE_AVATAR_BASE64 } from '../services/avatarData';
import {
  executeAgentSkill,
  type AgentSkillAsset,
  type AgentSkillId,
  type AgentSkillResult,
} from '../services/agentSkillExecutor';

export interface ImageModificationCardData {
  title: string;
  promptPreview: string;
  nodeName: string;
  workflowHint: string;
  imageCount: number;
  isConfirmed?: boolean;
  isExecuting?: boolean;
  isCompleted?: boolean;
}

interface Message {
  id?: string;
  role: 'user' | 'model';
  text: string;
  isConfirmationStep?: boolean;
  skillId?: string;
  skillTitle?: string;
  imageModCard?: ImageModificationCardData;
  assets?: AgentSkillResult[];
  isStreaming?: boolean;
  trace?: AgentTraceStep[];
}

interface AgentMemoryPoint {
  id: string;
  label: string;
  text: string;
  createdAt: number;
}

type MessageFeedback = 'up' | 'down';

interface AgentFeedbackEntry {
  rating: MessageFeedback;
  text: string;
  createdAt: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  skillId?: string;
  skillTitle?: string;
  agentPhase?: AgentPhase;
}

const generateSessionId = () => {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `sess-${ts}-${rand}`;
};

const formatSessionTime = (timestamp: number) => {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  if (isToday) {
    return `${hours}:${minutes}`;
  }
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${month}-${day} ${hours}:${minutes}`;
};

const DEFAULT_INITIAL_MESSAGE: Message = {
  role: 'model',
  text: '你好！我是您的小彻智能助手。今天想创作些什么？',
};

interface AssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  attachments?: { id: string; src: string; title: string }[];
  onRemoveAttachment?: (id: string) => void;
  onInsertAssetToCanvas?: (url: string, title: string, mediaType?: 'image' | 'video') => void;
  onLocateAssetOnCanvas?: (url: string) => boolean;
  onInsertImageModificationWorkflow?: (
    inputImages: { url: string; title: string }[],
    outputImage: { url: string; title: string; prompt: string },
  ) => void;
}

export interface AgentSkill {
  id: AgentSkillId;
  title: string;
  desc: string;
  prompt: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
}

type AgentPhase = 'idle' | 'intake' | 'review' | 'executing' | 'complete' | 'error';
type TraceStatus = 'pending' | 'active' | 'done' | 'error';

interface AgentTraceStep {
  id: string;
  label: string;
  detail: string;
  status: TraceStatus;
}

interface SkillGuide {
  minAssets: number;
  recommendedAssets: number;
  assetRules: string[];
  questions: string[];
  quickReplies: string[];
  plan: string[];
}

export const ALL_AGENT_SKILLS: AgentSkill[] = [
  {
    id: 'UNIVERSAL_TRY_ON',
    title: '万物上身与试穿',
    desc: '全套主图 / 详情强化 / UGC 实拍 / AI 造型师',
    prompt: '我想为我的商品图片生成商业真人试穿图...',
    icon: Shirt,
    color: 'text-purple-400',
  },
  {
    id: 'SINGLE_ITEM_TRY_ON',
    title: '单品试穿',
    desc: '服装单品快捷识别与真人穿搭效果合成',
    prompt: '我想对这件单品服装进行快速真人试穿...',
    icon: Scissors,
    color: 'text-indigo-400',
  },
  {
    id: 'RETOUCHING',
    title: '通用白底图精修',
    desc: '智能一键抠图出白底图 / 产品精修打光',
    prompt: '请帮我将商品图抠图处理为高清白底图...',
    icon: Sparkles,
    color: 'text-amber-400',
  },
  {
    id: 'PRODUCT_VIDEO',
    title: 'AI生成产品展示视频',
    desc: '言简意赅打造产品商业展现短视频',
    prompt: '请为我的产品生成一段动态商业展现短视频...',
    icon: Film,
    color: 'text-pink-400',
  },
  {
    id: 'MODEL_SCENE_FISSION',
    title: '模特场景图裂变',
    desc: '海量不同商业场景构图与氛围批量裂变',
    prompt: '请为我的模特图进行多商业场景图裂变...',
    icon: Camera,
    color: 'text-emerald-400',
  },
  {
    id: 'MODEL_POSE_FISSION',
    title: '模特姿势裂变',
    desc: '保持服装一致性，多角度姿势动作裂变',
    prompt: '请保持服装不变，生成多角度模特动作姿势...',
    icon: UserRoundCog,
    color: 'text-cyan-400',
  },
  {
    id: 'ECOMMERCE_HERO',
    title: '生成电商主图',
    desc: '电商高转化率主图设计与营销打标构图',
    prompt: '请为该商品设计符合高转化率的电商主图...',
    icon: Store,
    color: 'text-orange-400',
  },
  {
    id: 'IMAGE_CLEAN',
    title: '主图生成',
    desc: '主图细节增强与全画面质感重构',
    prompt: '请帮我提升画面质感，生成高分辨率主图...',
    icon: ImagePlus,
    color: 'text-blue-400',
  },
];

const SKILL_GUIDES: Record<AgentSkillId, SkillGuide> = {
  UNIVERSAL_TRY_ON: {
    minAssets: 1,
    recommendedAssets: 2,
    assetRules: ['@1 商品图：建议白底、无遮挡、结构清晰', '@2 模特/真人图：可选；上传后会锁定人物身份与姿势'],
    questions: ['商品要穿戴在哪个部位？', '希望保留原模特、自动匹配模特，还是只做局部展示？', '目标平台与画面风格是什么？'],
    quickReplies: ['自动匹配模特，商业棚拍', '保留原模特与姿势', 'UGC 生活方式实拍'],
    plan: ['识别商品结构与穿戴关系', '校验人物/商品素材顺序', '锁定身份、商品细节和构图', '生成并插入画布'],
  },
  SINGLE_ITEM_TRY_ON: {
    minAssets: 2,
    recommendedAssets: 2,
    assetRules: ['@1 单品商品图：白底或干净背景', '@2 真人/模特图：正面清晰、身体无遮挡', '多角度商品图可从 @3 起继续添加'],
    questions: ['这是上装、下装、鞋靴还是配饰？', '是否严格保留人物脸、姿势与背景？', '需要自然日常、棚拍还是街拍效果？'],
    quickReplies: ['严格保留人物与背景', '自然日常穿搭', '高级商业棚拍'],
    plan: ['分辨人物图与单品图', '分析版型、遮挡和穿着关系', '锁定人物身份与商品结构', '合成试穿效果并插入画布'],
  },
  RETOUCHING: {
    minAssets: 1,
    recommendedAssets: 1,
    assetRules: ['上传 1–8 张待精修商品图', '建议商品完整、边缘清晰、避免严重遮挡'],
    questions: ['背景需要纯白 #FFFFFF 还是保留轻微地面阴影？', '是否必须保留包装文字与 Logo？', '更偏真实棚拍还是精致 3D 商业质感？'],
    quickReplies: ['纯白底 + 轻微接触阴影', '严格保留文字与 Logo', '真实高级棚拍'],
    plan: ['逐张校验商品边缘与完整性', '锁定 SKU、颜色、文字和 Logo', '清理瑕疵并重建商业光影', '逐张输出并插入画布'],
  },
  PRODUCT_VIDEO: {
    minAssets: 1,
    recommendedAssets: 2,
    assetRules: ['至少 1 张清晰产品主图', '推荐补充细节图或不同角度图，避免视频中产品变形'],
    questions: ['投放平台与横竖屏是什么？', '最想强调的 1 个卖点是什么？', '希望镜头是环绕、推进、悬浮还是场景演示？'],
    quickReplies: ['9:16 竖屏电商短视频', '环绕展示 + 英雄收尾', '高级极简商业广告'],
    plan: ['识别产品与核心卖点', '设计镜头运动和节奏', '锁定产品一致性与首尾画面', '生成视频并插入画布'],
  },
  MODEL_SCENE_FISSION: {
    minAssets: 1,
    recommendedAssets: 1,
    assetRules: ['上传清晰的模特成片', '人物脸部、服装轮廓和光线关系需可辨认'],
    questions: ['希望裂变哪些场景？', '是否保留当前姿势与机位？', '目标市场、季节和品牌调性是什么？'],
    quickReplies: ['都市街拍 + 咖啡馆', '海边度假生活方式', '保留人物与服装，仅换场景'],
    plan: ['提取人物与服装视觉 DNA', '规划差异化商业场景', '锁定人物和服装一致性', '生成场景变体并插入画布'],
  },
  MODEL_POSE_FISSION: {
    minAssets: 1,
    recommendedAssets: 1,
    assetRules: ['上传一张清晰完整的模特参考图', '手脚尽量完整，服装图案和配饰清晰可见'],
    questions: ['希望生成全身、中景还是近景姿势？', '动作偏静态展示、行走还是互动？', '背景和机位是否保持不变？'],
    quickReplies: ['全身静态商业姿势', '自然行走抓拍', '背景不变，只改变姿势'],
    plan: ['识别人物骨架与服装约束', '规划自然且有差异的动作', '锁定脸、身材、服装与场景', '生成姿势变体并插入画布'],
  },
  ECOMMERCE_HERO: {
    minAssets: 1,
    recommendedAssets: 2,
    assetRules: ['至少 1 张准确的商品主图', '包装、标签或细节图可继续补充，帮助锁定 SKU'],
    questions: ['目标平台是 Amazon、淘宝、SHEIN 还是独立站？', '主打卖点与目标人群是什么？', '是否需要文案留白、角标或纯视觉主图？'],
    quickReplies: ['Amazon 主图，纯白合规', '淘宝高转化主图，预留文案区', '独立站高级极简主视觉'],
    plan: ['识别商品身份与平台规则', '提炼视觉焦点和转化卖点', '规划构图、留白与光影', '生成主图并插入画布'],
  },
  IMAGE_CLEAN: {
    minAssets: 1,
    recommendedAssets: 1,
    assetRules: ['上传需要增强的原始主图', '原图角度与商品主体应符合最终需求'],
    questions: ['只增强清晰度，还是同时重建光影与质感？', '背景、构图与比例是否严格锁定？', '是否需要清理灰尘、压缩噪点和边缘瑕疵？'],
    quickReplies: ['严格锁定构图，只增强质感', '清理瑕疵并重建光影', '保留全部文字与商品细节'],
    plan: ['检测清晰度与画面缺陷', '锁定构图、产品和文字', '增强纹理、边缘与层次', '生成高清主图并插入画布'],
  },
};

const ASSISTANT_SYSTEM_INSTRUCTION = `你是“小彻智能助手”，一名电商业精尖视觉创作 Agent。你的任务不仅是回答，更是帮助用户将粗粒度需求转化为商业高保真的生图/修图方案。
回答必须使用简洁中文，并遵循：
1. 先复述你理解到的目标；
2. 指出当前已有信息和仍缺少的信息（若有素材参考，列出已感知到的素材）；
3. 在规划生图方案与 Prompt 时，遵循【Imagen 3.0 7要素黄金公式】：
   - [主体描述] + [动作/状态] + [环境/场景] + [风格流派] + [光照描述] + [视角/构图] + [质量增强词]；
4. 如果已选择技能，围绕该技能的素材、平台、风格、比例和关键约束追问，最多追问 3 项；
5. 明确告知用户：方案确认后才会调用底层生成引擎；
6. 不要声称展示内部思维链，只提供可核验的“研判摘要”和下一步建议。`;

const readLocalJson = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
};

const parseInlineStyles = (text: string): React.ReactNode[] => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const content = part.slice(2, -2);
      return (
        <span key={i} className="text-white font-bold mx-0.5">
          {content}
        </span>
      );
    }
    return part;
  });
};

const renderFormattedMessage = (text: string) => {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  lines.forEach((line, index) => {
    const key = `line-${index}`;
    const trimmed = line.trim();

    if (!trimmed) {
      elements.push(<div key={key} className="h-2" />);
      return;
    }

    if (line.startsWith('# ')) {
      elements.push(
        <h1
          key={key}
          className="text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-300 mt-4 mb-2 border-b border-white/10 pb-2"
        >
          {parseInlineStyles(line.slice(2))}
        </h1>
      );
      return;
    }

    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={key} className="text-sm font-bold text-zinc-100 mt-3 mb-1.5 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
          {parseInlineStyles(line.slice(3))}
        </h2>
      );
      return;
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={key} className="flex items-start gap-2 text-xs text-zinc-300 leading-relaxed my-1 pl-1">
          <span className="text-orange-400 text-sm leading-none mt-0.5">•</span>
          <span className="flex-1">{parseInlineStyles(line.slice(2))}</span>
        </div>
      );
      return;
    }

    if (/^\d+\.\s/.test(line)) {
      const numberMatch = line.match(/^(\d+)\.\s(.*)/);
      if (numberMatch) {
        elements.push(
          <div key={key} className="flex items-start gap-2 text-xs text-zinc-300 leading-relaxed my-1 pl-1">
            <span className="text-orange-400 font-mono text-xs font-bold shrink-0">{numberMatch[1]}.</span>
            <span className="flex-1">{parseInlineStyles(numberMatch[2])}</span>
          </div>
        );
        return;
      }
    }

    elements.push(
      <p key={key} className="text-xs text-zinc-300 leading-relaxed my-1">
        {parseInlineStyles(line)}
      </p>
    );
  });

  return elements;
};

const AgentTraceView: React.FC<{ steps: AgentTraceStep[]; title?: string }> = ({ steps, title = 'Agent 工作过程' }) => {
  if (!steps.length) return null;
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/25 p-3" aria-label={title}>
      <div className="mb-2.5 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400">
        <Brain className="h-3.5 w-3.5 text-orange-400" />
        {title}
        <span className="ml-auto font-medium normal-case tracking-normal text-zinc-600">可核验执行摘要</span>
      </div>
      <div className="space-y-2">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-start gap-2.5">
            <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[9px] font-black ${
              step.status === 'done'
                ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                : step.status === 'active'
                  ? 'border-orange-400/50 bg-orange-400/10 text-orange-300'
                  : step.status === 'error'
                    ? 'border-red-400/40 bg-red-400/10 text-red-300'
                    : 'border-white/10 bg-white/[0.03] text-zinc-600'
            }`}>
              {step.status === 'done' ? <Check className="h-3 w-3" /> : step.status === 'active' ? <Loader2 className="h-3 w-3 animate-spin" /> : step.status === 'error' ? <X className="h-3 w-3" /> : index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-[11px] font-bold ${step.status === 'pending' ? 'text-zinc-500' : 'text-zinc-200'}`}>{step.label}</p>
              <p className="mt-0.5 text-[9px] leading-4 text-zinc-500">{step.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const AssistantPanel: React.FC<AssistantPanelProps> = ({
  isOpen,
  onClose,
  attachments = [],
  onRemoveAttachment,
  onInsertAssetToCanvas,
  onLocateAssetOnCanvas,
  onInsertImageModificationWorkflow,
}) => {
  // 历史对话 Session 管理
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = readLocalJson<ChatSession[]>('xiaoche_agent_chat_sessions', []);
    if (saved.length > 0) return saved;
    const initialId = generateSessionId();
    return [{
      id: initialId,
      title: '你好',
      messages: [DEFAULT_INITIAL_MESSAGE],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }];
  });

  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    const savedId = localStorage.getItem('xiaoche_agent_current_session_id');
    const savedSessions = readLocalJson<ChatSession[]>('xiaoche_agent_chat_sessions', []);
    if (savedId && savedSessions.some(s => s.id === savedId)) {
      return savedId;
    }
    if (savedSessions.length > 0) {
      return savedSessions[0].id;
    }
    return sessions[0]?.id || generateSessionId();
  });

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const [messages, setMessages] = useState<Message[]>(() => {
    const current = sessions.find(s => s.id === currentSessionId);
    return current?.messages && current.messages.length > 0 ? current.messages : [DEFAULT_INITIAL_MESSAGE];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<AgentSkill | null>(null);
  const [skillBrief, setSkillBrief] = useState('');
  const [uploadedAttachments, setUploadedAttachments] = useState<AgentSkillAsset[]>([]);
  const [generationStatus, setGenerationStatus] = useState('');
  const [isDraggingImages, setIsDraggingImages] = useState(false);
  const [agentPhase, setAgentPhase] = useState<AgentPhase>('idle');
  const [agentTrace, setAgentTrace] = useState<AgentTraceStep[]>([]);
  const [memoryPoints, setMemoryPoints] = useState<AgentMemoryPoint[]>(() => readLocalJson('xiaoche_agent_memory_points', []));
  const [activeMemoryQuote, setActiveMemoryQuote] = useState<AgentMemoryPoint | null>(null);
  const [messageFeedback, setMessageFeedback] = useState<Record<string, AgentFeedbackEntry>>(() => readLocalJson('xiaoche_agent_feedback', {}));
  const [actionNotice, setActionNotice] = useState<{ messageId: string; text: string } | null>(null);

  // 底部弹窗下拉菜单状态
  const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);
  const [selectedAgentMode, setSelectedAgentMode] = useState<'agent' | 'image' | 'video' | 'pose'>('agent');
  const [isSkillBookOpen, setIsSkillBookOpen] = useState(false);
  const [isAskMenuOpen, setIsAskMenuOpen] = useState(false);
  const [askMode, setAskMode] = useState<'ask' | 'auto'>('ask');

  // 生成偏好弹窗状态 (完全还原参考图 2 与 3)
  const [isPreferenceOpen, setIsPreferenceOpen] = useState(false);
  const [isAutoPreference, setIsAutoPreference] = useState(true); // 默认自动为 true
  const [preferenceTab, setPreferenceTab] = useState<'image' | 'video'>('image');
  
  // 图片参数
  const [imageRatio, setImageRatio] = useState<string>('智能'); // 默认是智能
  const [imageResolution, setImageResolution] = useState<string>('2k');
  const [imageModel, setImageModel] = useState<string>('Banana 2 (3.1 Flash)');

  // 视频参数
  const [videoRatio, setVideoRatio] = useState<string>('智能'); // 默认是智能
  const [videoResolution, setVideoResolution] = useState<string>('720p'); // 默认 720p
  const [videoDuration, setVideoDuration] = useState<string>('5s'); // 默认 5s
  const [videoModel, setVideoModel] = useState<string>('Seedance 2.0');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);

  const activeAttachments = useMemo(() => {
    const seen = new Set<string>();
    return [...attachments, ...uploadedAttachments].filter((asset) => {
      if (seen.has(asset.src)) return false;
      seen.add(asset.src);
      return true;
    }).slice(0, 10);
  }, [attachments, uploadedAttachments]);

  const selectedGuide = selectedSkill ? SKILL_GUIDES[selectedSkill.id] : null;
  const hasRequiredAssets = Boolean(selectedGuide && activeAttachments.length >= selectedGuide.minAssets);

  const updateTrace = (id: string, status: TraceStatus, detail?: string) => {
    setAgentTrace((current) => current.map((step) => step.id === id
      ? { ...step, status, detail: detail || step.detail }
      : step));
  };

  const streamLocalMessage = async (messageId: string, text: string) => {
    const chunks = text.match(/.{1,5}/gs) || [text];
    let fullText = '';
    for (const chunk of chunks) {
      fullText += chunk;
      setMessages((current) => current.map((message) => message.id === messageId
        ? { ...message, text: fullText, isStreaming: true }
        : message));
      await new Promise((resolve) => window.setTimeout(resolve, 12));
    }
    setMessages((current) => current.map((message) => message.id === messageId
      ? { ...message, text, isStreaming: false }
      : message));
  };

  const showActionNotice = (messageId: string, text: string) => {
    setActionNotice({ messageId, text });
    window.setTimeout(() => {
      setActionNotice((current) => current?.messageId === messageId ? null : current);
    }, 1800);
  };

  const copyMessage = async (messageId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showActionNotice(messageId, '已复制回复');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
      showActionNotice(messageId, '已复制回复');
    }
  };

  const rememberMessage = (messageId: string, text: string) => {
    const existingIndex = memoryPoints.findIndex((point) => point.text === text);
    const nextIndex = existingIndex >= 0 ? existingIndex : memoryPoints.length;
    const nextPoint: AgentMemoryPoint = existingIndex >= 0
      ? memoryPoints[existingIndex]
      : { id: crypto.randomUUID(), label: `记忆点${nextIndex + 1}`, text: text.slice(0, 2400), createdAt: Date.now() };
    const nextPoints = existingIndex >= 0 ? memoryPoints : [...memoryPoints, nextPoint].slice(-20);
    setMemoryPoints(nextPoints);
    setActiveMemoryQuote(nextPoint);
    localStorage.setItem('xiaoche_agent_memory_points', JSON.stringify(nextPoints));
    textareaRef.current?.focus();
    showActionNotice(messageId, `已引用为 @${nextPoint.label}`);
  };

  const rateMessage = (messageId: string, text: string, rating: MessageFeedback) => {
    const next = { ...messageFeedback };
    if (next[messageId]?.rating === rating) delete next[messageId];
    else next[messageId] = { rating, text: text.slice(0, 1600), createdAt: Date.now() };
    setMessageFeedback(next);
    localStorage.setItem('xiaoche_agent_feedback', JSON.stringify(next));
    showActionNotice(messageId, rating === 'up' ? '已记住：继续保持这类回答' : '已记住：后续避免这类回答');
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [messages, isLoading, isOpen]);

  useEffect(() => {
    if (!selectedSkill || !selectedGuide || agentPhase === 'executing' || agentPhase === 'complete') return;
    const ready = activeAttachments.length >= selectedGuide.minAssets;
    setAgentPhase(ready ? 'review' : 'intake');
    setAgentTrace((current) => current.map((step, index) => index === 0
      ? {
          ...step,
          status: ready ? 'done' : 'pending',
          detail: ready
            ? `已准备 ${activeAttachments.length} 张素材，可进入方案确认`
            : `当前 ${activeAttachments.length}/${selectedGuide.minAssets} 张必需素材`,
        }
      : step));
  }, [activeAttachments.length, selectedGuide, selectedSkill, agentPhase]);

  const handleSelectSkillFlow = (skill: AgentSkill) => {
    const guide = SKILL_GUIDES[skill.id];
    setSelectedSkill(skill);
    setSkillBrief(askMode === 'auto'
      ? `${skill.prompt}\n非关键项由 Agent 使用推荐默认值补齐，关键素材和最终方案仍需用户确认。`
      : skill.prompt);
    setIsSkillBookOpen(false);
    setAgentPhase(activeAttachments.length >= guide.minAssets ? 'review' : 'intake');
    setAgentTrace(guide.plan.map((label, index) => ({
      id: `plan-${index}`,
      label,
      detail: index === 0 ? '等待素材与创作要求确认' : '将在前一步完成后执行',
      status: 'pending',
    })));

    const confirmPrompt = `## 已进入「${skill.title}」Agent\n\n**研判摘要**：这项任务需要先确认素材角色与创作目标，不能只上传图片就直接生成。${askMode === 'auto' ? ' 当前为 Auto 模式，我会自动补齐非关键参数，但关键素材和最终执行仍会请你确认。' : ''}\n\n**请按顺序准备素材**\n${guide.assetRules.map((rule) => `- ${rule}`).join('\n')}\n\n**还需要你确认**\n${guide.questions.map((question, index) => `- ${index + 1}. ${question}`).join('\n')}\n\n当前检测到 **${activeAttachments.length} 张素材**，最低需要 **${guide.minAssets} 张**。你可以上传素材并直接描述要求；信息齐备后，我会先给出执行方案，由你最后确认再生成。`;
    const messageId = `skill-guide-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { role: 'user', text: `选择技能：${skill.title}` },
      {
        id: messageId,
        role: 'model',
        text: '',
        isConfirmationStep: true,
        skillId: skill.id,
        skillTitle: skill.title,
      },
    ]);
    void streamLocalMessage(messageId, confirmPrompt);
  };

  const handleConfirmAndExecuteSkill = async (skill: AgentSkill, appendUserConfirmation = true) => {
    if (isLoading) return;
    const guide = SKILL_GUIDES[skill.id];
    if (activeAttachments.length < guide.minAssets) {
      const missing = guide.minAssets - activeAttachments.length;
      const messageId = `missing-assets-${Date.now()}`;
      const warning = `## 暂时不能开始生成\n\n还缺少 **${missing} 张必需素材**。${guide.assetRules.slice(activeAttachments.length, guide.minAssets).map((rule) => `\n- ${rule}`).join('')}\n\n上传后我会自动更新素材检查状态，再请你确认方案。`;
      setAgentPhase('intake');
      setMessages((prev) => [...prev, { id: messageId, role: 'model', text: '', skillTitle: skill.title }]);
      void streamLocalMessage(messageId, warning);
      return;
    }
    if (appendUserConfirmation) {
      setMessages((prev) => [...prev, { role: 'user', text: `确认开始制作【${skill.title}】` }]);
    }
    setIsLoading(true);
    setAgentPhase('executing');
    setGenerationStatus('正在准备真实生成任务…');
    setAgentTrace(guide.plan.map((label, index) => ({
      id: `plan-${index}`,
      label,
      detail: index === 0 ? '正在检查输入素材与任务约束' : '等待执行',
      status: index === 0 ? 'active' : 'pending',
    })));

    try {
      const results = await executeAgentSkill({
        skillId: skill.id,
        skillTitle: skill.title,
        prompt: selectedSkill?.id === skill.id && skillBrief.trim() ? skillBrief.trim() : skill.prompt,
        assets: activeAttachments,
        preferences: {
          imageRatio,
          imageResolution,
          imageModel,
          videoRatio,
          videoResolution,
          videoDuration,
          videoModel,
        },
        onProgress: (progress) => {
          setGenerationStatus(progress);
          if (progress.includes('读取') || progress.includes('校验')) {
            updateTrace('plan-0', 'active', progress);
          } else if (progress.includes('调用')) {
            updateTrace('plan-0', 'done', '素材角色、数量与格式已通过校验');
            updateTrace('plan-1', 'done', `已根据「${skill.title}」组装执行方案`);
            updateTrace('plan-2', 'active', progress);
          } else if (progress.includes('完成')) {
            updateTrace('plan-2', 'done', '真实生成引擎已返回可用资产');
            updateTrace('plan-3', 'active', progress);
          }
        },
      });

      setAgentTrace((current) => current.map((step) => ({ ...step, status: 'done', detail: step.id === 'plan-3' ? '结果已保存并插入左侧工作区' : step.detail })));
      setAgentPhase('complete');
      setMessages((prev) => [...prev, {
        role: 'model',
        text: `## 【${skill.title}】生成完成\n\n已生成 **${results.length} 个真实资产**，保存到项目历史并插入左侧画布。你可以继续告诉我“调整光影”“换一个场景”或“再生成一版”，我会沿用本次已确认的约束。`,
        assets: results,
        skillTitle: skill.title,
        trace: guide.plan.map((label, index) => ({ id: `done-${index}`, label, detail: '已完成', status: 'done' })),
      }]);
      results.forEach((result) => {
        onInsertAssetToCanvas?.(result.url, result.title, result.mediaType);
      });
    } catch (error: unknown) {
      setAgentPhase('error');
      setAgentTrace((current) => current.map((step) => step.status === 'active'
        ? { ...step, status: 'error', detail: error instanceof Error ? error.message : '执行失败' }
        : step));
      setMessages((prev) => [...prev, {
        role: 'model',
        text: `**【${skill.title}】执行失败**\n\n${error instanceof Error ? error.message : '生成服务发生未知错误，请重试。'}`,
      }]);
    } finally {
      setGenerationStatus('');
      setIsLoading(false);
    }
  };

  const handleConfirmImageModification = async (messageId: string, card: ImageModificationCardData) => {
    if (isLoading || activeAttachments.length === 0) return;

    setMessages((current) => current.map((m) => m.id === messageId
      ? { ...m, imageModCard: { ...m.imageModCard!, isConfirmed: true, isExecuting: true } }
      : m));

    setIsLoading(true);
    setGenerationStatus(`正在执行【${card.title}】图像修改工作流…`);

    const statusMessageId = `status-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: `确认，开始生成【${card.title}】` },
      {
        id: statusMessageId,
        role: 'model',
        text: `**${card.nodeName}**工作流已经在后台运行中，请稍后查看生成结果。`,
      },
    ]);

    try {
      const results = await executeAgentSkill({
        skillId: 'RETOUCHING',
        skillTitle: card.title,
        prompt: card.promptPreview,
        assets: activeAttachments,
        preferences: {
          imageRatio,
          imageResolution,
          imageModel,
          videoRatio,
          videoResolution,
          videoDuration,
          videoModel,
        },
        onProgress: (prog) => setGenerationStatus(prog),
      });

      setMessages((current) => current.map((m) => m.id === messageId
        ? { ...m, imageModCard: { ...m.imageModCard!, isExecuting: false, isCompleted: true } }
        : m));

      const completionId = `done-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: completionId,
          role: 'model',
          text: `## 【${card.title}】生成完成\n\n已成功生成修改后的图像，并在左侧无限画布中成功关联连线。`,
          assets: results,
        },
      ]);

      const primaryInput = activeAttachments[0] || { src: '', title: '原图' };
      const primaryOutput = results[0] || { url: '', title: card.title };
      onInsertImageModificationWorkflow?.(
        [{ url: primaryInput.src, title: primaryInput.title }],
        { url: primaryOutput.url, title: card.title, prompt: card.promptPreview }
      );
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'model', text: `**【${card.title}】执行失败**\n\n${err.message || '生成错误，请重试。'}` },
      ]);
    } finally {
      setIsLoading(false);
      setGenerationStatus('');
    }
  };

  const handleLocalUpload = async (files: File[]) => {
    const accepted = files.filter((file) => file.type.startsWith('image/')).slice(0, Math.max(0, 10 - activeAttachments.length));
    const next = await Promise.all(accepted.map((file) => new Promise<AgentSkillAsset>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error(`无法读取 ${file.name}`));
      reader.onload = () => resolve({
        id: crypto.randomUUID(),
        src: String(reader.result),
        title: file.name,
      });
      reader.readAsDataURL(file);
    })));
    setUploadedAttachments((current) => {
      const seen = new Set([...attachments, ...current].map((asset) => asset.src));
      const uniqueNext = next.filter((asset) => {
        if (seen.has(asset.src)) return false;
        seen.add(asset.src);
        return true;
      });
      const availableSlots = Math.max(0, 10 - attachments.length - current.length);
      return [...current, ...uniqueNext.slice(0, availableSlots)];
    });
  };

  const handlePasteImages = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const imageFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));

    if (imageFiles.length === 0) return;
    event.preventDefault();
    void handleLocalUpload(imageFiles);
  };

  const handleImageDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (!Array.from(event.dataTransfer.types).includes('Files')) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingImages(true);
  };

  const handleImageDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!Array.from(event.dataTransfer.types).includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleImageDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDraggingImages(false);
  };

  const handleImageDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDraggingImages(false);
    void handleLocalUpload(Array.from(event.dataTransfer.files));
  };

  const removeActiveAttachment = (id: string) => {
    if (uploadedAttachments.some((asset) => asset.id === id)) {
      setUploadedAttachments((current) => current.filter((asset) => asset.id !== id));
    } else {
      onRemoveAttachment?.(id);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userText = input.trim();
    const quotedMemory = activeMemoryQuote;
    setInput('');
    setActiveMemoryQuote(null);

    setMessages((prev) => [...prev, { role: 'user', text: userText }]);

    const isExecutionConfirmation = /^(确认|确认开始|开始|开始生成|好|好的|可以|执行)[！!。.]?$/.test(userText);
    if (selectedSkill && isExecutionConfirmation) {
      void handleConfirmAndExecuteSkill(selectedSkill, false);
      return;
    }

    // 当用户上传了参考图（1~10张）且提出修改/调整指令时，智能生成图生图确认卡片（参考图 1 效果）
    const isImageModIntent = activeAttachments.length > 0 && (
      !selectedSkill ||
      /换|改|调整|修|发型|背景|服装|衣服|头发|变|替换|生成|白底/.test(userText)
    );

    if (isImageModIntent) {
      const cleanTitle = userText.length > 12 ? `${userText.slice(0, 10)}...` : userText;
      const nodeName = userText.length > 8 ? `${userText.slice(0, 6)}型` : userText;
      const promptPreview = `Keep the original model's face, facial features, skin tone, expression, cream-colored cut-out blouse, white trousers, and background exactly unchanged. Change the specified styling to: ${userText}, maintaining high-end editorial fashion photography style, photorealistic, 8k resolution.`;

      const cardId = `mod-card-${Date.now()}`;
      const cardData: ImageModificationCardData = {
        title: cleanTitle.startsWith('更换') || cleanTitle.startsWith('修改') || cleanTitle.startsWith('调整') ? cleanTitle : `更换${cleanTitle}发型`,
        promptPreview,
        nodeName: nodeName.includes('型') ? nodeName : `${nodeName}发型`,
        workflowHint: '图生图',
        imageCount: activeAttachments.length,
      };

      setMessages((prev) => [
        ...prev,
        {
          id: cardId,
          role: 'model',
          text: `已精准识别已上传的 **${activeAttachments.length} 张原图素材**\n针对您的修改意图“**${userText}**”，已自动规划生成工作流方案：`,
          imageModCard: cardData,
        },
      ]);
      return;
    }

    if (selectedSkill) {
      setSkillBrief((current) => `${current}\n用户补充要求：${userText}`.trim());
      setAgentPhase(hasRequiredAssets ? 'review' : 'intake');
    }

    setIsLoading(true);
    setGenerationStatus(selectedSkill ? '正在理解补充要求并更新执行方案…' : '正在理解你的创作意图…');
    const responseId = `assistant-stream-${Date.now()}`;
    setMessages((prev) => [...prev, { id: responseId, role: 'model', text: '', isStreaming: true, skillTitle: selectedSkill?.title }]);

    try {
      const history = messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
      const guideContext = selectedSkill && selectedGuide
        ? `\n\n当前技能：${selectedSkill.title}\n当前素材数：${activeAttachments.length}，最低需要：${selectedGuide.minAssets}\n素材规则：${selectedGuide.assetRules.join('；')}\n待确认问题：${selectedGuide.questions.join('；')}\n当前用户简报：${skillBrief || selectedSkill.prompt}`
        : '';
      const attachmentContext = activeAttachments.length > 0
        ? `\n\n【关键已知信息：用户已在当前对话面板中成功上传并提供了 ${activeAttachments.length} 张原图素材/照片】：\n${activeAttachments.map((att, idx) => `- 素材照片 @${idx + 1}：${att.title}`).join('\n')}\n系统已感知到此素材，绝对不要认为或告知用户“未获取到照片”或“缺少原图素材”。请基于已上传的原图素材回应用户。`
        : '\n\n【用户当前暂未上传任何参考照片素材】';
      const memoryContext = memoryPoints.length
        ? `\n\n用户主动引用的长期记忆点（需要持续遵守）：\n${memoryPoints.slice(-12).map((point) => `- ${point.label}：${point.text}`).join('\n')}`
        : '';
      const activeQuoteContext = quotedMemory
        ? `\n\n本轮用户明确引用的内容（本轮回答优先围绕它理解与回应）：\n${quotedMemory.label}：${quotedMemory.text}`
        : '';
      const feedbackEntries = Object.values(messageFeedback).slice(-12);
      const feedbackContext = feedbackEntries.length
        ? `\n\n用户对历史回答的反馈：\n${feedbackEntries.map((entry) => entry.rating === 'up'
          ? `- 正向示例，延续其准确度与表达方式：${entry.text}`
          : `- 负向示例，不要重复其中的错误、假设或表达方式：${entry.text}`).join('\n')}`
        : '';
      await sendChatMessageStream(history, userText, (_chunk, fullText) => {
        setMessages((prev) => prev.map((message) => message.id === responseId
          ? { ...message, text: fullText, isStreaming: true }
          : message));
      }, { systemInstruction: ASSISTANT_SYSTEM_INSTRUCTION + guideContext + attachmentContext + memoryContext + activeQuoteContext + feedbackContext });
      setMessages((prev) => prev.map((message) => message.id === responseId
        ? { ...message, isStreaming: false }
        : message));
    } catch (error: any) {
      setMessages((prev) => prev.map((message) => message.id === responseId
        ? { ...message, text: error.message || '连接错误，请稍后重试。', isStreaming: false }
        : message));
    } finally {
      setGenerationStatus('');
      setIsLoading(false);
    }
  };

  // 自动将当前对话与状态同步到 Session 列表与 localStorage
  useEffect(() => {
    if (!currentSessionId) return;

    const firstUserMsg = messages.find(m => m.role === 'user');
    let sessionTitle = '你好';
    if (firstUserMsg && firstUserMsg.text.trim()) {
      const cleanText = firstUserMsg.text
        .replace(/^选择技能：/, '')
        .replace(/^确认开始制作.*/, '')
        .trim();
      if (cleanText) {
        sessionTitle = cleanText.slice(0, 26);
      }
    } else if (selectedSkill) {
      sessionTitle = selectedSkill.title;
    }

    setSessions(prevSessions => {
      const existingIndex = prevSessions.findIndex(s => s.id === currentSessionId);
      const updatedSession: ChatSession = {
        id: currentSessionId,
        title: sessionTitle,
        messages,
        createdAt: existingIndex >= 0 ? prevSessions[existingIndex].createdAt : Date.now(),
        updatedAt: Date.now(),
        skillId: selectedSkill?.id,
        skillTitle: selectedSkill?.title,
        agentPhase,
      };

      let newSessions: ChatSession[];
      if (existingIndex >= 0) {
        newSessions = [...prevSessions];
        newSessions[existingIndex] = updatedSession;
      } else {
        newSessions = [updatedSession, ...prevSessions];
      }

      localStorage.setItem('xiaoche_agent_chat_sessions', JSON.stringify(newSessions));
      localStorage.setItem('xiaoche_agent_current_session_id', currentSessionId);
      return newSessions;
    });
  }, [messages, selectedSkill, agentPhase, currentSessionId]);

  const handleCreateNewSession = () => {
    if (isLoading) return;
    const newId = generateSessionId();
    const newSession: ChatSession = {
      id: newId,
      title: '你好',
      messages: [DEFAULT_INITIAL_MESSAGE],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const updatedSessions = [newSession, ...sessions];
    setSessions(updatedSessions);
    setCurrentSessionId(newId);
    setMessages([DEFAULT_INITIAL_MESSAGE]);
    setSelectedSkill(null);
    setSkillBrief('');
    setUploadedAttachments([]);
    setAgentPhase('idle');
    setAgentTrace([]);
    setGenerationStatus('');
    setActiveMemoryQuote(null);
    setIsHistoryOpen(false);

    localStorage.setItem('xiaoche_agent_chat_sessions', JSON.stringify(updatedSessions));
    localStorage.setItem('xiaoche_agent_current_session_id', newId);
    showActionNotice('new-session', '已开启新对话');
  };

  const handleSwitchSession = (targetSessionId: string) => {
    if (targetSessionId === currentSessionId) {
      setIsHistoryOpen(false);
      return;
    }
    const target = sessions.find(s => s.id === targetSessionId);
    if (!target) return;

    setCurrentSessionId(targetSessionId);
    setMessages(target.messages && target.messages.length > 0 ? target.messages : [DEFAULT_INITIAL_MESSAGE]);

    if (target.skillId) {
      const foundSkill = ALL_AGENT_SKILLS.find(sk => sk.id === target.skillId);
      setSelectedSkill(foundSkill || null);
    } else {
      setSelectedSkill(null);
    }

    setAgentPhase(target.agentPhase || 'idle');
    setSkillBrief('');
    setUploadedAttachments([]);
    setGenerationStatus('');
    setActiveMemoryQuote(null);
    setIsHistoryOpen(false);

    localStorage.setItem('xiaoche_agent_current_session_id', targetSessionId);
  };

  const handleDeleteSession = (sessionIdToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = sessions.filter(s => s.id !== sessionIdToDelete);

    if (filtered.length === 0) {
      const newId = generateSessionId();
      const newSession: ChatSession = {
        id: newId,
        title: '你好',
        messages: [DEFAULT_INITIAL_MESSAGE],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setSessions([newSession]);
      setCurrentSessionId(newId);
      setMessages([DEFAULT_INITIAL_MESSAGE]);
      setSelectedSkill(null);
      setAgentPhase('idle');
      localStorage.setItem('xiaoche_agent_chat_sessions', JSON.stringify([newSession]));
      localStorage.setItem('xiaoche_agent_current_session_id', newId);
    } else {
      setSessions(filtered);
      localStorage.setItem('xiaoche_agent_chat_sessions', JSON.stringify(filtered));

      if (sessionIdToDelete === currentSessionId) {
        const nextSession = filtered[0];
        setCurrentSessionId(nextSession.id);
        setMessages(nextSession.messages && nextSession.messages.length > 0 ? nextSession.messages : [DEFAULT_INITIAL_MESSAGE]);
        if (nextSession.skillId) {
          const foundSkill = ALL_AGENT_SKILLS.find(sk => sk.id === nextSession.skillId);
          setSelectedSkill(foundSkill || null);
        } else {
          setSelectedSkill(null);
        }
        setAgentPhase(nextSession.agentPhase || 'idle');
        localStorage.setItem('xiaoche_agent_current_session_id', nextSession.id);
      }
    }
    showActionNotice('delete-session', '会话已删除');
  };

  const handleCopySessionId = async () => {
    try {
      await navigator.clipboard.writeText(currentSessionId);
      showActionNotice('copy-session-id', '已复制 Session ID');
    } catch {
      showActionNotice('copy-session-id', '复制失败');
    }
  };

  const handleRefreshHistory = () => {
    const saved = readLocalJson<ChatSession[]>('xiaoche_agent_chat_sessions', []);
    if (saved.length > 0) {
      setSessions(saved);
    }
    showActionNotice('refresh-history', '历史对话已同步');
  };

  const handleClearChat = () => {
    handleCreateNewSession();
  };

  return (
    <div
      ref={panelRef}
      onPaste={handlePasteImages}
      onWheel={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      className={`assistant-panel-container fixed right-0 top-0 bottom-0 h-[100dvh] w-full sm:w-[560px] sm:max-w-full bg-[#0d0d0f]/98 border-l border-white/10 shadow-2xl z-40 flex flex-col overflow-hidden transition-all duration-300 ${
        isOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
      }`}
    >
      {/* 提示 Toast */}
      {actionNotice && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-full bg-orange-500/90 text-white text-xs font-bold shadow-lg backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
          {actionNotice.text}
        </div>
      )}

      {/* 1. 顶栏 (小彻智能助手、戴墨镜小彻头像、Session ID、历史对话/新建/关闭) */}
      <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#0d0d0f] z-10 shrink-0 select-none">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full overflow-hidden border border-orange-500/40 shadow-[0_0_12px_rgba(249,115,22,0.4)] shrink-0">
            <img src={XIAOCHE_AVATAR_BASE64} alt="小彻智能助手" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-zinc-100 tracking-wide flex items-center gap-2">
              小彻智能助手
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span 
                className="text-[10px] text-zinc-400 font-mono tracking-tight bg-white/5 px-1.5 py-0.5 rounded border border-white/10 truncate max-w-[130px] sm:max-w-[170px]"
                title={currentSessionId}
              >
                {currentSessionId}
              </span>
              <button
                type="button"
                onClick={handleCopySessionId}
                className="text-zinc-500 hover:text-zinc-200 p-0.5 rounded hover:bg-white/5 transition-colors shrink-0"
                title="复制 Session ID"
              >
                <Copy size={11} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* 历史对话图标按钮 */}
          <button
            type="button"
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
              isHistoryOpen
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40 shadow-sm'
                : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
            }`}
            title="历史对话"
          >
            <Clock size={17} />
          </button>
          {/* 新建对话图标按钮 */}
          <button
            type="button"
            onClick={handleCreateNewSession}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 hover:bg-white/5 hover:text-zinc-200 transition-colors"
            title="新建对话"
          >
            <MessageSquarePlus size={17} />
          </button>
          {/* 关闭面板图标按钮 */}
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 hover:bg-white/5 hover:text-zinc-200 transition-colors"
            title="关闭面板"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* 2. 主体区：历史对话视图 OR 正常对话聊天视图 */}
      {isHistoryOpen ? (
        <div className="flex-1 flex flex-col bg-[#0d0d0f] z-20 overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between bg-[#111114]">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-400" />
              <h3 className="text-sm font-bold text-zinc-100 tracking-wide">历史对话</h3>
              <span className="text-[11px] text-zinc-500 font-medium ml-1">
                ({sessions.length})
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleRefreshHistory}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/5 hover:text-zinc-200 transition-colors"
                title="刷新历史对话"
              >
                <RefreshCw size={14} />
              </button>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/5 hover:text-zinc-200 transition-colors"
                title="关闭历史"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5 custom-scrollbar">
            {sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Clock className="w-10 h-10 text-zinc-600 mb-3 stroke-[1.5]" />
                <p className="text-xs text-zinc-400 font-medium">暂无历史对话记录</p>
                <button
                  type="button"
                  onClick={handleCreateNewSession}
                  className="mt-4 px-4 py-2 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-bold hover:bg-orange-500/30 transition-all flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  新建对话
                </button>
              </div>
            ) : (
              sessions
                .slice()
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((s) => {
                  const isActive = s.id === currentSessionId;
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSwitchSession(s.id)}
                      className={`group relative flex flex-col p-4 rounded-2xl border transition-all cursor-pointer select-none ${
                        isActive
                          ? 'bg-[#1b1b1e] border-orange-500/40 shadow-lg shadow-orange-500/5'
                          : 'bg-[#141417]/80 border-white/[0.04] hover:bg-[#1c1c20] hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className={`text-xs font-bold truncate ${isActive ? 'text-orange-400' : 'text-zinc-200 group-hover:text-white'}`}>
                            {s.title || '未命名对话'}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-medium mt-1">
                            {formatSessionTime(s.updatedAt)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {isActive && (
                            <span className="text-[9px] font-bold text-orange-400 bg-orange-500/15 px-2 py-0.5 rounded-md border border-orange-500/30 mr-1">
                              当前
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSession(s.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-white/5 transition-all"
                            title="删除会话"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>

          <div className="p-4 border-t border-white/5 bg-[#111114]">
            <button
              type="button"
              onClick={handleCreateNewSession}
              className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2"
            >
              <Plus size={15} />
              开启新对话
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 2. 主体区 (添加 max-w-[440px] mx-auto 精细居中，防止过度拉宽) */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar bg-[#0d0d0f]">
        <div className="max-w-[440px] mx-auto w-full">
        {messages.length === 1 && messages[0].text === '你好！我是您的小彻智能助手。今天想创作些什么？' ? (
          <div className="flex flex-col items-start pt-2 pb-16 animate-in fade-in duration-500">
            {/* 头像 + 问候语 横向 Flex 并列 */}
            <div className="flex items-center gap-3.5 mb-6">
              <div className="w-12 h-12 rounded-full overflow-hidden border border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.5)] relative shrink-0">
                <img src={XIAOCHE_AVATAR_BASE64} alt="小彻智能助手" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-zinc-500 tracking-wider">Hi 创作者！</span>
                <h2 className="text-xl font-bold text-white mt-0.5 tracking-tight">今天一起创作点什么？</h2>
              </div>
            </div>

            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">
              选择技能
            </span>

            <div className="w-full space-y-2 max-h-[480px] overflow-y-auto custom-scrollbar pr-1">
              {ALL_AGENT_SKILLS.slice(0, 8).map((skill) => {
                const IconComponent = skill.icon;
                return (
                  <div
                    key={skill.id}
                    onClick={() => handleSelectSkillFlow(skill)}
                    className="flex items-center w-full px-3.5 py-3 rounded-2xl bg-[#141417]/80 border border-white/[0.03] hover:bg-white/5 hover:border-orange-500/40 transition-all duration-200 cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-zinc-800/60 border border-white/5 flex items-center justify-center mr-3.5 shrink-0 group-hover:bg-zinc-800 transition-colors">
                      <IconComponent size={16} className={`${skill.color} group-hover:scale-110 transition-transform`} />
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-xs font-bold text-zinc-200 group-hover:text-white transition-colors">
                        {skill.title}
                      </span>
                      <span className="text-[10px] text-zinc-500 truncate mt-0.5">{skill.desc}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-5 pb-20">
            {messages.map((m, i) => {
              const messageId = m.id || `message-${i}`;
              const feedback = messageFeedback[messageId]?.rating;
              const locatableAsset = m.assets?.[0];
              return (
              <div key={messageId} className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex flex-col gap-1.5 ${m.role === 'user' ? 'max-w-[88%] items-end' : 'w-full items-start'}`}>
                  <div className="flex items-center gap-2 px-1">
                    {m.role === 'model' && (
                      <>
                        <span className="h-5 w-5 overflow-hidden rounded-full border border-orange-400/30 bg-orange-400/10">
                          <img src={XIAOCHE_AVATAR_BASE64} alt="" className="h-full w-full object-cover" />
                        </span>
                        <span className="text-[10px] font-bold text-zinc-400 tracking-wider">小彻智能助手</span>
                      </>
                    )}
                    {m.role === 'user' && (
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        You
                      </span>
                    )}
                  </div>

                  <div
                    className={`relative ${
                      m.role === 'user'
                        ? 'rounded-2xl rounded-tr-sm border border-white/10 bg-[#242428] px-4 py-3 text-slate-100 shadow-sm'
                        : 'w-full px-1 py-1 text-slate-200'
                    }`}
                  >
                    {m.role === 'model' ? (
                      <div>
                        {renderFormattedMessage(m.text)}

                        {m.isStreaming && <span className="ml-1 inline-block h-4 w-1 animate-pulse rounded-full bg-orange-400 align-middle" aria-label="正在流式输出" />}

                        {m.trace && m.trace.length > 0 && (
                          <div className="mt-3">
                            <AgentTraceView steps={m.trace} title="本次任务执行记录" />
                          </div>
                        )}

                        {m.assets && m.assets.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {m.assets.map((asset, assetIndex) => (
                              <div key={`${asset.url}-${assetIndex}`} className="overflow-hidden rounded-xl border border-orange-500/30 bg-black/40 p-2 space-y-2">
                                {asset.mediaType === 'video' ? (
                                  <video src={asset.url} className="h-40 w-full rounded-lg bg-black object-contain" controls playsInline />
                                ) : (
                                  <img src={asset.url} alt={asset.title} className="h-40 w-full rounded-lg object-contain" />
                                )}
                                <div className="flex items-center justify-between gap-2 px-1 text-[0.68rem] font-bold text-orange-400">
                                  <span>✓ 已插入左侧工作区画布</span>
                                  <button
                                    type="button"
                                    onClick={() => onInsertAssetToCanvas?.(asset.url, asset.title, asset.mediaType)}
                                    className="shrink-0 underline hover:text-orange-300"
                                  >
                                    再次插入画布
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {!m.isStreaming && m.text && (
                          <div className="mt-2 flex min-h-11 w-full items-center gap-0.5 text-zinc-600" aria-label="回复操作">
                            <button
                              type="button"
                              onClick={() => void copyMessage(messageId, m.text)}
                              className="flex h-11 w-11 items-center justify-center rounded-xl transition hover:bg-white/[0.05] hover:text-zinc-300"
                              title="复制回复"
                              aria-label="复制回复"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => rememberMessage(messageId, m.text)}
                              className="flex h-11 w-11 items-center justify-center rounded-xl transition hover:bg-white/[0.05] hover:text-orange-300"
                              title="引用为记忆点"
                              aria-label="引用为记忆点"
                            >
                              <Quote className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={!locatableAsset || !onLocateAssetOnCanvas}
                              onClick={() => {
                                if (!locatableAsset || !onLocateAssetOnCanvas) return;
                                const found = onLocateAssetOnCanvas(locatableAsset.url);
                                if (!found) showActionNotice(messageId, '画布中未找到对应资产');
                              }}
                              className="flex h-11 w-11 items-center justify-center rounded-xl transition hover:bg-white/[0.05] hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-25"
                              title={locatableAsset ? '在画布中定位' : '这条回复没有画布资产'}
                              aria-label="在画布中定位"
                            >
                              <LocateFixed className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => rateMessage(messageId, m.text, 'up')}
                              className={`flex h-11 w-11 items-center justify-center rounded-xl transition hover:bg-white/[0.05] hover:text-emerald-300 ${feedback === 'up' ? 'bg-emerald-400/10 text-emerald-300' : ''}`}
                              title="这个回答是对的"
                              aria-label="点赞，这个回答是对的"
                              aria-pressed={feedback === 'up'}
                            >
                              <ThumbsUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => rateMessage(messageId, m.text, 'down')}
                              className={`flex h-11 w-11 items-center justify-center rounded-xl transition hover:bg-white/[0.05] hover:text-red-300 ${feedback === 'down' ? 'bg-red-400/10 text-red-300' : ''}`}
                              title="这个回答需要改进"
                              aria-label="差评，这个回答需要改进"
                              aria-pressed={feedback === 'down'}
                            >
                              <ThumbsDown className="h-3.5 w-3.5" />
                            </button>
                            {actionNotice?.messageId === messageId && (
                              <span className="ml-1 text-[9px] font-bold text-zinc-400 animate-in fade-in">{actionNotice.text}</span>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="leading-6 text-xs whitespace-pre-wrap">{m.text}</p>
                    )}
                  </div>

                  {/* 图像修改调整确认卡片 (还原参考图 1 效果) */}
                  {m.imageModCard && (
                    <div className="mt-3 w-full overflow-hidden rounded-3xl border border-emerald-500/30 bg-[#161619] p-4 shadow-xl select-none">
                      {/* 1. 顶部标题与附件计数 */}
                      <div className="flex items-center justify-between border-b border-white/5 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                            <Sparkles className="h-4 w-4" />
                          </div>
                          <h4 className="text-sm font-bold text-white tracking-tight">{m.imageModCard.title}</h4>
                        </div>
                        <span className="rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 text-[10px] font-bold text-zinc-400">
                          图片{m.imageModCard.imageCount}图
                        </span>
                      </div>

                      {/* 2. 生成提示词区域 */}
                      <div className="mt-3.5 space-y-1.5">
                        <div className="text-[11px] font-bold text-zinc-400">
                          生成提示词
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/50 p-3">
                          <p className="text-xs text-zinc-300 leading-relaxed font-mono select-text cursor-text">
                            {m.imageModCard.promptPreview}
                          </p>
                        </div>
                      </div>

                      {/* 3. 画布工作流 (1个节点) */}
                      <div className="mt-3.5 space-y-1.5">
                        <div className="text-[11px] font-bold text-zinc-400">
                          画布工作流 (1个节点)
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300">
                            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                            {m.imageModCard.nodeName} <span className="text-[9px] bg-amber-500/20 px-1.5 py-0.2 rounded border border-amber-500/40 text-amber-200">图生图</span>
                          </span>
                        </div>
                      </div>

                      {/* 4. 操作按钮：确认，开始生成 */}
                      {!m.imageModCard.isConfirmed ? (
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleConfirmImageModification(messageId, m.imageModCard!)}
                          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#00c985] hover:bg-[#00b377] py-3 text-xs font-black text-white shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <Plus size={15} />
                          确认，开始生成
                        </button>
                      ) : (
                        <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-bold text-emerald-300 flex items-center gap-2">
                          <Check size={15} />
                          <span>工作流已确认，节点已在左侧画布创建并关联连线</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              );
            })}

            {selectedSkill && selectedGuide && agentPhase !== 'executing' && agentPhase !== 'complete' && (
              <section className="overflow-hidden rounded-3xl border border-orange-500/25 bg-gradient-to-b from-[#1d1b1a] to-[#141416] shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
                <div className="border-b border-white/[0.06] px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-orange-400">
                        <ListChecks className="h-3.5 w-3.5" />
                        {hasRequiredAssets ? '阶段 2/3 · 方案确认' : '阶段 1/3 · 信息收集'}
                      </div>
                      <h3 className="mt-1 text-sm font-black text-white">{selectedSkill.title}</h3>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-black ${hasRequiredAssets ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300' : 'border-amber-400/25 bg-amber-400/10 text-amber-300'}`}>
                      {hasRequiredAssets ? '素材检查通过' : `素材 ${activeAttachments.length}/${selectedGuide.minAssets}`}
                    </span>
                  </div>
                </div>

                <div className="space-y-4 p-4">
                  <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-3">
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-black text-zinc-400">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />素材角色检查
                    </div>
                    <div className="space-y-1.5">
                      {selectedGuide.assetRules.map((rule, index) => {
                        const checked = index < activeAttachments.length || index >= selectedGuide.minAssets;
                        return (
                          <div key={rule} className="flex items-start gap-2 text-[10px] leading-4">
                            {checked ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" /> : <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600" />}
                            <span className={checked ? 'text-zinc-300' : 'text-zinc-500'}>{rule}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500">快捷补充创作方向</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedGuide.quickReplies.map((reply) => (
                        <button
                          key={reply}
                          type="button"
                          onClick={() => {
                            setInput((current) => `${current}${current ? '；' : ''}${reply}`);
                            textareaRef.current?.focus();
                          }}
                          className="min-h-9 rounded-xl border border-white/[0.07] bg-white/[0.04] px-2.5 text-[10px] font-bold text-zinc-300 transition hover:border-orange-400/35 hover:bg-orange-400/10 hover:text-orange-200"
                        >
                          + {reply}
                        </button>
                      ))}
                    </div>
                  </div>

                  <AgentTraceView steps={agentTrace} title="计划中的 Agent 工作流" />

                  <div className="rounded-xl bg-white/[0.035] px-3 py-2.5 text-[9px] leading-4 text-zinc-500">
                    输出偏好：{selectedSkill.id === 'PRODUCT_VIDEO' ? `${videoRatio} · ${videoResolution} · ${videoDuration} · ${videoModel}` : `${imageRatio} · ${imageResolution} · ${imageModel}`}
                  </div>

                  {!hasRequiredAssets && (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-400/15 bg-amber-400/[0.06] px-3 py-2.5 text-[10px] leading-4 text-amber-200/80">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      请先在下方上传缺少的素材。Agent 不会在输入不完整时直接生成。
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setIsPreferenceOpen(true)}
                      className="min-h-11 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-bold text-zinc-300 transition hover:bg-white/[0.08]"
                    >
                      调整生成参数
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleConfirmAndExecuteSkill(selectedSkill)}
                      disabled={!hasRequiredAssets || isLoading}
                      className="min-h-11 rounded-xl bg-orange-500 px-3 text-xs font-black text-white shadow-lg shadow-orange-500/15 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none"
                    >
                      {hasRequiredAssets ? '确认方案，开始生成' : '等待必需素材'}
                    </button>
                  </div>
                </div>
              </section>
            )}

            {isLoading && !messages.some((message) => message.isStreaming) && (
              <div className="flex justify-start w-full">
                <div className="w-full space-y-3 rounded-2xl border border-white/5 bg-[#1c1c1e] px-4 py-3 text-xs text-orange-400">
                  <div className="flex items-center gap-2">
                    <Loader2 size={15} className="animate-spin" />
                    <span>{generationStatus || '正在流式组织回复…'}</span>
                  </div>
                  {selectedSkill && agentPhase === 'executing' && <AgentTraceView steps={agentTrace} />}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}
        </div>
      </div>

      {/* 3. 底部输入框与工具栏 */}
      <div className="p-4 bg-[#0d0d0f] border-t border-white/[0.03] shrink-0 flex flex-col gap-2 relative z-10 select-none">
        
        {/* === 弹窗 1：Agent 模式选择 === */}
        {isAgentMenuOpen && (
          <div className="absolute bottom-[90px] left-4 w-60 rounded-2xl border border-white/10 bg-[#18181c]/98 p-2 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <button
              type="button"
              onClick={() => {
                setSelectedAgentMode('agent');
                setIsAgentMenuOpen(false);
              }}
              className={`flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition ${
                selectedAgentMode === 'agent'
                  ? 'bg-emerald-500/10 border border-emerald-500/30'
                  : 'hover:bg-white/5'
              }`}
            >
              <Sparkles className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white">Agent</p>
                <p className="text-[10px] text-zinc-400">AI 创意助手，自动规划工作流</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedAgentMode('image');
                setIsAgentMenuOpen(false);
              }}
              className="flex w-full items-start gap-3 rounded-xl p-2.5 text-left hover:bg-white/5 transition"
            >
              <ImagePlus className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white">图片生成</p>
                <p className="text-[10px] text-zinc-400">选择模型，直接生成图片</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedAgentMode('video');
                setIsAgentMenuOpen(false);
              }}
              className="flex w-full items-start gap-3 rounded-xl p-2.5 text-left hover:bg-white/5 transition"
            >
              <Film className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white">视频生成</p>
                <p className="text-[10px] text-zinc-400">选择模型，直接生成视频</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedAgentMode('pose');
                setIsAgentMenuOpen(false);
              }}
              className="flex w-full items-start gap-3 rounded-xl p-2.5 text-left hover:bg-white/5 transition"
            >
              <UserRoundCog className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white">动作模仿</p>
                <p className="text-[10px] text-zinc-400">上传角色图与参考视频，迁移动作</p>
              </div>
            </button>
          </div>
        )}

        {/* === 弹窗 2：技能书全量功能菜单 === */}
        {isSkillBookOpen && (
          <div className="absolute bottom-[90px] left-4 right-4 max-h-[360px] overflow-y-auto custom-scrollbar rounded-2xl border border-white/10 bg-[#18181c]/98 p-3 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2 px-1">
              <span className="text-xs font-black text-white flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-orange-400" />
                技能书 (全量创意中心功能)
              </span>
              <button
                type="button"
                onClick={() => setIsSkillBookOpen(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-1.5">
              {ALL_AGENT_SKILLS.map((skill) => {
                const IconComponent = skill.icon;
                return (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => handleSelectSkillFlow(skill)}
                    className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-white/10 transition group"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/80 border border-white/5 shrink-0">
                      <IconComponent className={`h-4 w-4 ${skill.color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-zinc-200 group-hover:text-white truncate">
                        {skill.title}
                      </p>
                      <p className="text-[10px] text-zinc-400 truncate">{skill.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* === 弹窗 3：Ask 确认模式切换 === */}
        {isAskMenuOpen && (
          <div className="absolute bottom-[90px] right-14 w-52 rounded-2xl border border-white/10 bg-[#18181c]/98 p-2 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <button
              type="button"
              onClick={() => {
                setAskMode('ask');
                setIsAskMenuOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-xl p-2.5 text-left transition ${
                askMode === 'ask' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:bg-white/5'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <MessageSquareQuote className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-white">Ask</p>
                  <p className="text-[10px] text-zinc-400">生成前请求确认</p>
                </div>
              </div>
              {askMode === 'ask' && <Check className="h-4 w-4 text-orange-400 shrink-0" />}
            </button>

            <button
              type="button"
              onClick={() => {
                setAskMode('auto');
                setIsAskMenuOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-xl p-2.5 text-left transition ${
                askMode === 'auto' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:bg-white/5'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <SlidersHorizontal className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-white">Auto</p>
                  <p className="text-[10px] text-zinc-400">自动补齐非关键项，生成前仍确认</p>
                </div>
              </div>
              {askMode === 'auto' && <Check className="h-4 w-4 text-emerald-400 shrink-0" />}
            </button>
          </div>
        )}

        {/* === 弹窗 4：【生成偏好】高保真配置 Modal (完全还原参考图 2 与 图 3) === */}
        {isPreferenceOpen && (
          <div className="absolute bottom-[90px] right-4 left-4 rounded-3xl border border-white/10 bg-[#121215]/98 p-4 shadow-2xl backdrop-blur-2xl z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
            {/* 顶栏：标题与自动 Switch 开关 (参考图 2 顶部) */}
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <span className="text-sm font-bold text-white tracking-wide">生成偏好</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-400">自动</span>
                <button
                  type="button"
                  onClick={() => setIsAutoPreference(!isAutoPreference)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isAutoPreference ? 'bg-lime-400' : 'bg-zinc-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow-lg ring-0 transition duration-200 ease-in-out ${
                      isAutoPreference ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* 图片 / 视频 分段 Tab 切换 */}
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/40 p-1 my-3 border border-white/5">
              <button
                type="button"
                onClick={() => setPreferenceTab('image')}
                className={`py-1.5 rounded-lg text-xs font-bold transition ${
                  preferenceTab === 'image'
                    ? 'bg-[#222226] text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                图片
              </button>
              <button
                type="button"
                onClick={() => setPreferenceTab('video')}
                className={`py-1.5 rounded-lg text-xs font-bold transition ${
                  preferenceTab === 'video'
                    ? 'bg-[#222226] text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                视频
              </button>
            </div>

            {/* 图片偏好面板 (参考图 2) */}
            {preferenceTab === 'image' && (
              <div className="space-y-3.5">
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">
                    选择比例
                  </span>
                  <div className="grid grid-cols-5 gap-1.5 text-center">
                    {['智能', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9', '1:4', '4:1', '1:8', '8:1'].slice(0, 10).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setImageRatio(r)}
                        className={`py-1.5 rounded-lg text-[10px] font-bold border transition ${
                          imageRatio === r
                            ? 'border-lime-400 bg-lime-400/10 text-lime-400 font-extrabold shadow-[0_0_10px_rgba(163,230,53,0.2)]'
                            : 'border-white/5 bg-white/5 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">
                    清晰度
                  </span>
                  <div className="flex gap-2">
                    {['1k', '2k', '4k'].map((res) => (
                      <button
                        key={res}
                        type="button"
                        onClick={() => setImageResolution(res)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition ${
                          imageResolution === res
                            ? 'border-lime-400 bg-lime-400/10 text-lime-400 font-bold'
                            : 'border-white/5 bg-white/5 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {res}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">
                    模型选择
                  </span>
                  <div className="relative">
                    <select
                      value={imageModel}
                      onChange={(e) => setImageModel(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-zinc-200 focus:border-lime-400 focus:outline-none"
                    >
                      <option value="Banana 2 (3.1 Flash)" className="bg-[#18181c]">🍌 Banana 2 (3.1 Flash)</option>
                      <option value="Banana Pro (3.0 Pro)" className="bg-[#18181c]">🍌 Banana Pro (3.0 Pro)</option>
                      <option value="GPT Image 2 (Ultra Quality)" className="bg-[#18181c]">✴️ GPT Image 2 (Ultra Quality)</option>
                      <option value="Midjourney (MJ Imagine)" className="bg-[#18181c]">❖ Midjourney (MJ Imagine)</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-2.5 h-4 w-4 text-zinc-500 pointer-events-none" />
                  </div>
                </div>
              </div>
            )}

            {/* 视频偏好面板 (参考图 3) */}
            {preferenceTab === 'video' && (
              <div className="space-y-3.5">
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">
                    选择比例
                  </span>
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    {['智能', '16:9', '4:3', '1:1', '3:4', '9:16', '21:9'].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setVideoRatio(r)}
                        className={`py-1.5 rounded-lg text-[10px] font-bold border transition ${
                          videoRatio === r
                            ? 'border-lime-400 bg-lime-400/10 text-lime-400 font-extrabold shadow-[0_0_10px_rgba(163,230,53,0.2)]'
                            : 'border-white/5 bg-white/5 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">
                    清晰度 (默认 720p)
                  </span>
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    {['480p', '720p', '1080p', '2k', '4k', 'native1080p'].map((res) => (
                      <button
                        key={res}
                        type="button"
                        onClick={() => setVideoResolution(res)}
                        className={`py-1.5 rounded-lg text-[10px] font-bold border transition ${
                          videoResolution === res
                            ? 'border-lime-400 bg-lime-400/10 text-lime-400 font-extrabold shadow-[0_0_10px_rgba(163,230,53,0.2)]'
                            : 'border-white/5 bg-white/5 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {res}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">
                    时长 (默认 5s)
                  </span>
                  <div className="grid grid-cols-6 gap-1 text-center">
                    {['4s', '5s', '6s', '7s', '8s', '9s', '10s', '11s', '12s', '13s', '14s', '15s'].map((dur) => (
                      <button
                        key={dur}
                        type="button"
                        onClick={() => setVideoDuration(dur)}
                        className={`py-1 rounded-lg text-[10px] font-bold border transition ${
                          videoDuration === dur
                            ? 'border-lime-400 bg-lime-400/10 text-lime-400 font-extrabold'
                            : 'border-white/5 bg-white/5 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {dur}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">
                    模型选择
                  </span>
                  <div className="relative">
                    <select
                      value={videoModel}
                      onChange={(e) => setVideoModel(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-zinc-200 focus:border-lime-400 focus:outline-none"
                    >
                      <option value="Seedance 2.0" className="bg-[#18181c]">🎬 Seedance 2.0 动态引擎</option>
                      <option value="Luma-DreamMachine" className="bg-[#18181c]">⚡ Luma Dream Machine 极速流畅</option>
                      <option value="Runway-Gen3" className="bg-[#18181c]">🎥 Runway Gen-3 电影高保真</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-2.5 h-4 w-4 text-zinc-500 pointer-events-none" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 输入框包围卡片 */}
        <div
          onDragEnter={handleImageDragEnter}
          onDragOver={handleImageDragOver}
          onDragLeave={handleImageDragLeave}
          onDrop={handleImageDrop}
          className={`relative bg-[#18181c] border rounded-[20px] shadow-2xl p-2.5 flex flex-col gap-2.5 transition-all ${
            isDraggingImages
              ? 'border-orange-400/80 bg-orange-500/10 ring-2 ring-orange-500/20'
              : 'border-white/[0.04] focus-within:border-orange-500/30'
          }`}
        >
          {isDraggingImages && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[20px] bg-[#18181c]/90 backdrop-blur-sm">
              <div className="flex items-center gap-2 rounded-xl border border-orange-400/40 bg-orange-500/10 px-4 py-2 text-xs font-semibold text-orange-200">
                <Upload size={16} />
                松开即可添加图片
              </div>
            </div>
          )}
          {activeMemoryQuote && (
            <div className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.055] pl-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] animate-in fade-in slide-in-from-bottom-1">
              <span className="h-6 w-0.5 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] leading-5 text-zinc-400" title={activeMemoryQuote.text}>
                  {activeMemoryQuote.text.replace(/\s+/g, ' ')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveMemoryQuote(null)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-zinc-500 transition hover:bg-white/[0.05] hover:text-zinc-200"
                title="取消引用"
                aria-label="取消引用"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {activeAttachments.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-0.5 custom-scrollbar" aria-label="已引用素材">
              {activeAttachments.map((asset, index) => (
                <div key={asset.id} className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/40">
                  <img src={asset.src} alt={asset.title} className="h-full w-full object-cover" />
                  <span className="absolute bottom-0 left-0 rounded-tr-md bg-black/70 px-1 text-[8px] font-bold text-white">@{index + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeActiveAttachment(asset.id)}
                    className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/75 text-white opacity-0 transition group-hover:opacity-100"
                    aria-label={`移除 ${asset.title}`}
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2.5 items-start">
            <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              className="relative w-[42px] h-[42px] rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer shrink-0"
              title="点击、粘贴或拖拽上传参考图"
            >
              <Upload size={17} />
            </button>
            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => {
                void handleLocalUpload(Array.from(event.target.files || []));
                event.target.value = '';
              }}
            />

            <textarea
              ref={textareaRef as any}
              className="flex-1 bg-transparent border-0 resize-none py-2 px-1 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-0 leading-5 custom-scrollbar min-h-[42px] max-h-[100px]"
              placeholder="先上传参考图，再用 @ 引用，输入你的想法..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              rows={1}
            />
          </div>

          {/* 底栏控制条 (包含 AUTO 生成偏好参数按钮，完全还原参考图 1) */}
          <div className="flex items-center justify-between border-t border-white/[0.02] pt-2 px-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              {/* 1. Agent 下拉按钮 */}
              <button
                type="button"
                onClick={() => {
                  setIsAgentMenuOpen(!isAgentMenuOpen);
                  setIsSkillBookOpen(false);
                  setIsAskMenuOpen(false);
                  setIsPreferenceOpen(false);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition cursor-pointer"
              >
                <Sparkles size={12} className="text-emerald-400" />
                <span className="text-[11px] font-bold">
                  {selectedAgentMode === 'agent' ? 'Agent' : selectedAgentMode === 'image' ? '图片生成' : selectedAgentMode === 'video' ? '视频生成' : '动作模仿'}
                </span>
                <ChevronDown size={10} className="text-emerald-400" />
              </button>

              {/* 2. @ 引用 */}
              <button
                type="button"
                onClick={() => {
                  if (!activeAttachments.length) {
                    uploadInputRef.current?.click();
                    return;
                  }
                  const refs = activeAttachments.map((_, index) => `@${index + 1}`).join(' ');
                  setInput((current) => `${current}${current ? ' ' : ''}${refs}`);
                  textareaRef.current?.focus();
                }}
                className="p-1.5 text-zinc-500 hover:text-zinc-300 transition"
                title="引用素材"
              >
                <AtSign size={13} />
              </button>

              {/* 3. 技能书按钮 */}
              <button
                type="button"
                onClick={() => {
                  setIsSkillBookOpen(!isSkillBookOpen);
                  setIsAgentMenuOpen(false);
                  setIsAskMenuOpen(false);
                  setIsPreferenceOpen(false);
                }}
                className="p-1.5 text-zinc-500 hover:text-orange-400 transition"
                title="打开技能书"
              >
                <BookOpen size={13} />
              </button>

              {/* 4. Ask / Auto 模式下拉按钮 */}
              <button
                type="button"
                onClick={() => {
                  setIsAskMenuOpen(!isAskMenuOpen);
                  setIsAgentMenuOpen(false);
                  setIsSkillBookOpen(false);
                  setIsPreferenceOpen(false);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-zinc-300 text-[11px] hover:bg-white/10 transition cursor-pointer"
              >
                <MessageSquareQuote size={11} className="text-orange-400" />
                <span className="font-bold">{askMode === 'ask' ? 'Ask' : 'Auto'}</span>
                <ChevronDown size={10} className="text-zinc-500" />
              </button>

              {/* 5. AUTO 生成偏好控制按钮 (带有绿色 AUTO 亮光 Tag，点击弹出图2/3生成偏好) */}
              <button
                type="button"
                onClick={() => {
                  setIsPreferenceOpen(!isPreferenceOpen);
                  setIsAgentMenuOpen(false);
                  setIsSkillBookOpen(false);
                  setIsAskMenuOpen(false);
                }}
                className="relative p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 transition cursor-pointer group"
                title="打开生成偏好配置"
              >
                <SlidersHorizontal size={13} className="text-lime-400 group-hover:scale-110 transition-transform" />
                <span className="absolute -top-2 -right-2 px-1 py-0.2 text-[6px] font-black bg-lime-400 text-black rounded-full scale-90 uppercase tracking-wide shadow-sm">
                  AUTO
                </span>
              </button>

              {/* 6. 爆款实验室 */}
              <button
                type="button"
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl border border-white/5 bg-white/5 text-zinc-400 hover:text-zinc-200 transition"
              >
                <Zap size={11} className="text-orange-400" />
                <span className="text-[10px] font-bold">爆款实验室</span>
              </button>
            </div>

            {/* 发送按钮 */}
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={!input.trim() || isLoading}
              className={`w-7 h-7 rounded-full transition-all duration-300 flex items-center justify-center cursor-pointer ${
                input.trim() && !isLoading
                  ? 'bg-orange-500 text-white hover:bg-orange-400 shadow-md'
                  : 'bg-white/5 text-zinc-600 cursor-not-allowed'
              }`}
            >
              <ArrowUp size={14} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
};

export default AssistantPanel;
