import React, { useRef, useEffect, useMemo, useState } from 'react';
import { 
  X, Eraser, Copy, CornerDownLeft, Loader2, Sparkles, Brain, PenLine, Wand2,
  Shirt, Palette, Award, Home, MessageSquare, Clapperboard, Megaphone, ScanFace, Zap,
  Clock, Plus, AtSign, FileText, Globe, ArrowUp, ChevronDown, ChevronRight, RotateCcw,
  ArrowLeftRight, Camera, Crop, Expand, Film, ImagePlus, Layers3, PackageCheck, Paintbrush,
  ScanSearch, Scissors, Store, UserRoundCog, Check, Send, LayoutTemplate, BookOpen, MessageSquareQuote,
  SlidersHorizontal, CheckCircle2, Circle, Settings2, Upload
} from 'lucide-react';
import { sendChatMessage } from '../services/geminiService';
import { XIAOCHE_AVATAR_BASE64 } from '../services/avatarData';
import {
  executeAgentSkill,
  type AgentSkillAsset,
  type AgentSkillId,
  type AgentSkillResult,
} from '../services/agentSkillExecutor';

interface Message {
  role: 'user' | 'model';
  text: string;
  isConfirmationStep?: boolean;
  skillId?: string;
  skillTitle?: string;
  assets?: AgentSkillResult[];
}

interface AssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  attachments?: { id: string; src: string; title: string }[];
  onRemoveAttachment?: (id: string) => void;
  onInsertAssetToCanvas?: (url: string, title: string, mediaType?: 'image' | 'video') => void;
}

export interface AgentSkill {
  id: AgentSkillId;
  title: string;
  desc: string;
  prompt: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
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
          {line.replace(/^#\s/, '')}
        </h1>
      );
      return;
    }

    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={key} className="text-sm font-bold text-white mt-3 mb-1.5 flex items-center gap-2">
          <span className="w-1 h-3.5 bg-orange-500 rounded-full inline-block" />
          {line.replace(/^##\s/, '')}
        </h2>
      );
      return;
    }

    if (line.startsWith('* ') || line.startsWith('- ')) {
      const content = line.replace(/^[\*\-]\s/, '');
      elements.push(
        <div key={key} className="flex gap-2 ml-1 mb-1 items-start group/list">
          <span className="w-1.5 h-1.5 rounded-full bg-white/20 mt-[7px] shrink-0 group-hover/list:bg-orange-400 transition-colors" />
          <div className="text-[13px] leading-relaxed text-slate-300 flex-1">
            {parseInlineStyles(content)}
          </div>
        </div>
      );
      return;
    }

    elements.push(
      <div key={key} className="text-[13px] leading-relaxed text-slate-300 mb-1">
        {parseInlineStyles(line)}
      </div>
    );
  });

  return <div className="space-y-0.5 select-text cursor-text">{elements}</div>;
};

export const AssistantPanel: React.FC<AssistantPanelProps> = ({
  isOpen,
  onClose,
  attachments = [],
  onRemoveAttachment,
  onInsertAssetToCanvas,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: '你好！我是您的小彻智能助手。今天想创作些什么？' },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<AgentSkill | null>(null);
  const [skillBrief, setSkillBrief] = useState('');
  const [uploadedAttachments, setUploadedAttachments] = useState<AgentSkillAsset[]>([]);
  const [generationStatus, setGenerationStatus] = useState('');
  const [isDraggingImages, setIsDraggingImages] = useState(false);

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
    }).slice(0, 8);
  }, [attachments, uploadedAttachments]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [messages, isLoading, isOpen]);

  const handleSelectSkillFlow = (skill: AgentSkill) => {
    setSelectedSkill(skill);
    setSkillBrief(skill.prompt);
    setIsSkillBookOpen(false);

    if (askMode === 'auto') {
      void handleConfirmAndExecuteSkill(skill);
      return;
    }

    const confirmPrompt = `已为您选择技能：**【${skill.title}】**\n\n📌 **真实执行流程**：\n确认后将在当前聊天中调用创意中心的真实生成引擎；完成的结果会显示在这里，并自动插入左侧画布。\n\n当前已准备 **${activeAttachments.length} 张参考图**。你可以继续上传素材或补充要求，然后回复**“确认开始”**。`;

    setMessages((prev) => [
      ...prev,
      { role: 'user', text: `选择技能：${skill.title}` },
      {
        role: 'model',
        text: confirmPrompt,
        isConfirmationStep: true,
        skillId: skill.id,
        skillTitle: skill.title,
      },
    ]);
  };

  const handleConfirmAndExecuteSkill = async (skill: AgentSkill, appendUserConfirmation = true) => {
    if (isLoading) return;
    if (appendUserConfirmation) {
      setMessages((prev) => [...prev, { role: 'user', text: `确认开始制作【${skill.title}】` }]);
    }
    setIsLoading(true);
    setGenerationStatus('正在准备真实生成任务…');

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
        onProgress: setGenerationStatus,
      });

      setMessages((prev) => [...prev, {
        role: 'model',
        text: `🎉 **【${skill.title}】生成完成！**\n\n已生成 ${results.length} 个真实资产，并自动插入当前工作区画布。`,
        assets: results,
        skillTitle: skill.title,
      }]);
      results.forEach((result) => {
        onInsertAssetToCanvas?.(result.url, result.title, result.mediaType);
      });
    } catch (error: unknown) {
      setMessages((prev) => [...prev, {
        role: 'model',
        text: `**【${skill.title}】执行失败**\n\n${error instanceof Error ? error.message : '生成服务发生未知错误，请重试。'}`,
      }]);
    } finally {
      setGenerationStatus('');
      setIsLoading(false);
    }
  };

  const handleLocalUpload = async (files: File[]) => {
    const accepted = files.filter((file) => file.type.startsWith('image/')).slice(0, Math.max(0, 8 - activeAttachments.length));
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
      const availableSlots = Math.max(0, 8 - attachments.length - current.length);
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
    setInput('');

    setMessages((prev) => [...prev, { role: 'user', text: userText }]);

    const isExecutionConfirmation = /^(确认|确认开始|开始|开始生成|好|好的|可以|执行)[！!。.]?$/.test(userText);
    if (selectedSkill && isExecutionConfirmation) {
      void handleConfirmAndExecuteSkill(selectedSkill, false);
      return;
    }

    if (selectedSkill) {
      setSkillBrief((current) => `${current}\n用户补充要求：${userText}`.trim());
    }

    setIsLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
      const responseText = await sendChatMessage(history, userText, {});
      setMessages((prev) => [...prev, { role: 'model', text: responseText }]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'model', text: error.message || '连接错误，请稍后重试。' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([{ role: 'model', text: '你好！我是您的小彻智能助手。今天想创作些什么？' }]);
    setSelectedSkill(null);
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
      className={`assistant-panel-container fixed right-0 top-0 bottom-0 h-screen w-[560px] bg-[#0d0d0f]/98 border-l border-white/10 shadow-2xl z-40 flex flex-col overflow-hidden transition-all duration-300 ${
        isOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
      }`}
    >
      {/* 1. 顶栏 (小彻智能助手、戴墨镜小彻头像、历史/刷新/关闭) */}
      <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#0d0d0f] z-10 shrink-0 select-none">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full overflow-hidden border border-orange-500/40 shadow-[0_0_12px_rgba(249,115,22,0.4)] shrink-0">
            <img src={XIAOCHE_AVATAR_BASE64} alt="小彻智能助手" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-zinc-100 tracking-wide flex items-center gap-2">
              小彻智能助手
            </span>
            <span className="text-[9px] text-zinc-500 font-semibold tracking-wider font-mono">
              sess-663...663092
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleClearChat}
            className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors"
            title="重置对话"
          >
            <RotateCcw size={16} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors"
            title="关闭面板"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* 2. 主体区 (添加 max-w-[440px] mx-auto 精细居中，防止过度拉宽) */}
      <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-[#0d0d0f]">
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
            {messages.map((m, i) => (
              <div key={i} className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex flex-col max-w-[92%] gap-1.5 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-2 px-1">
                    {m.role === 'model' && (
                      <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">
                        小彻智能助手
                      </span>
                    )}
                    {m.role === 'user' && (
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        You
                      </span>
                    )}
                  </div>

                  <div
                    className={`relative px-4 py-3 rounded-2xl shadow-sm border ${
                      m.role === 'user'
                        ? 'bg-[#2c2c2e] border-white/10 text-slate-100 rounded-tr-sm'
                        : 'bg-[#1c1c1e] border-white/5 text-slate-300 rounded-tl-sm w-full'
                    }`}
                  >
                    {m.role === 'model' ? (
                      <div>
                        {renderFormattedMessage(m.text)}

                        {m.isConfirmationStep && selectedSkill && (
                          <div className="mt-3.5 pt-3 border-t border-white/10 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void handleConfirmAndExecuteSkill(selectedSkill)}
                              disabled={isLoading}
                              className="flex items-center gap-1.5 rounded-xl bg-orange-500 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-orange-400 transition shadow-lg shadow-orange-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Check className="h-3.5 w-3.5 stroke-[3]" />
                              🚀 确认无误，开始生成
                            </button>

                            <button
                              type="button"
                              onClick={handleClearChat}
                              className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-300 hover:bg-white/10 transition"
                            >
                              重新选择
                            </button>
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
                      </div>
                    ) : (
                      <p className="leading-6 text-xs whitespace-pre-wrap">{m.text}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start w-full">
                <div className="flex items-center gap-2 px-4 py-3 bg-[#1c1c1e] border border-white/5 rounded-2xl text-xs text-orange-400">
                  <Loader2 size={15} className="animate-spin" />
                  <span>{generationStatus || '正在调度创意中心真实生成引擎…'}</span>
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
                  <p className="text-[10px] text-zinc-400">无需确认直接生成</p>
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
              placeholder="点击、粘贴或拖拽图片，再用 @ 引用并输入想法..."
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
    </div>
  );
};

export default AssistantPanel;
