import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, Brain, ArrowLeft, Send, Image as ImageIcon, X, Copy, Check,
  ShieldCheck, Loader2, Settings, Zap, ChevronDown, ChevronRight, Clock, Bookmark,
  Terminal, Plus, Mic, PanelLeftClose, PanelLeftOpen, Trash2, Github, CheckCircle2,
  Code2, MoreVertical, Edit3, Pin, LogOut
} from 'lucide-react';
import { sendChatMessageStream, urlToBase64 } from '../modules/XcAISTUDIO-main/services/geminiService';
import {
  runClaudeCodeAgent,
  CLAUDE_CODE_PLUGINS,
  type ClaudeCodeAgentResponse,
} from '../modules/XcAISTUDIO-main/services/claudeCodeAgent';
import { compressImageFiles } from '../modules/Cyzx4/utils/imageCompressor';
import { UnifiedSettingsModal } from './UnifiedSettingsModal';

export interface SparkMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  images?: string[];
  thinkingSummary?: string;
  claudeCodePlan?: ClaudeCodeAgentResponse;
  isStreaming?: boolean;
  timestamp: number;
}

export interface SparkSession {
  id: string;
  title: string;
  excerpt?: string;
  messages: SparkMessage[];
  updatedAt: number;
  isPinned?: boolean;
}

interface SparkChatStudioProps {
  initialInput?: string;
  initialImages?: string[];
  initialModel?: string;
  onBack: () => void;
}

const MODEL_OPTIONS = [
  { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', badge: '默认/推荐', desc: '全维度智能推理与逻辑生成' },
  { id: 'claude-code', name: 'Claude Code Agent', badge: '⚡ Agentic', desc: '搭载 xiaoche0907/claude-code Agent 架构' },
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', badge: 'Fast', desc: '极速响应与商业图文规划' },
  { id: 'grok-4.6', name: 'Grok 4.6', badge: 'New', desc: '跨领域实时大语言推理' },
  { id: 'claude-opus-5', name: 'Claude Opus 5', badge: 'Pro', desc: '高阶复杂推理与商业策略' },
];

export const SparkChatStudio: React.FC<SparkChatStudioProps> = ({
  initialInput = '',
  initialImages = [],
  initialModel = 'gpt-5.6-luna',
  onBack,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sessions, setSessions] = useState<SparkSession[]>(() => {
    try {
      const saved = localStorage.getItem('spark_agent_sessions');
      return saved ? JSON.parse(saved) : [
        {
          id: 'demo-1',
          title: 'Nanobanana 服装复刻系统设置',
          excerpt: '生成了包含详细参数的专业摄影指示模板。',
          updatedAt: Date.now() - 3 * 3600 * 1000,
          messages: [],
        },
        {
          id: 'demo-2',
          title: 'Nanobanana 高保真视觉复刻',
          excerpt: '生成了符合要求的详细图像复刻提示词。',
          updatedAt: Date.now() - 8 * 3600 * 1000,
          messages: [],
        },
      ];
    } catch {
      return [];
    }
  });

  // Active Session State: if null, renders Gemini Spark Empty Home View (Image 2)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    if (initialInput.trim() || initialImages.length > 0) {
      return Date.now().toString();
    }
    return null;
  });

  const [messages, setMessages] = useState<SparkMessage[]>([]);
  const [homeInput, setHomeInput] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [uploadedImages, setUploadedImages] = useState<string[]>(initialImages);
  const [selectedModel, setSelectedModel] = useState<string>(initialModel);
  const [selectedPluginId, setSelectedPluginId] = useState<string>('frontend-design');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showPluginDropdown, setShowPluginDropdown] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({});
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialProcessedRef = useRef(false);

  const scrollToBottom = (smooth = true) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Save sessions to local storage
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('spark_agent_sessions', JSON.stringify(sessions.slice(0, 30)));
    }
  }, [sessions]);

  // Sync active messages to active session
  useEffect(() => {
    if (!activeSessionId || messages.length === 0) return;
    setSessions((prev) => {
      const userText = messages.find((m) => m.role === 'user')?.text || '新策划任务';
      const modelText = messages.find((m) => m.role === 'model')?.text || '生成了详细提示词与流程规划。';
      const title = userText.slice(0, 18) + (userText.length > 18 ? '...' : '');
      const excerpt = modelText.slice(0, 32) + (modelText.length > 32 ? '...' : '');

      const idx = prev.findIndex((s) => s.id === activeSessionId);
      const updated: SparkSession = {
        id: activeSessionId,
        title,
        excerpt,
        messages,
        updatedAt: Date.now(),
      };

      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [updated, ...prev];
    });
  }, [messages, activeSessionId]);

  // Handle Initial User Input from Homepage
  useEffect(() => {
    if (initialProcessedRef.current) return;
    initialProcessedRef.current = true;

    if (initialInput.trim() || initialImages.length > 0) {
      void handleSend(initialInput, initialImages);
    }
  }, []);

  const handleStartNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setUploadedImages([]);
    setHomeInput('');
    setChatInput('');
  };

  const handleSelectSession = (session: SparkSession) => {
    setActiveSessionId(session.id);
    setMessages(session.messages.length > 0 ? session.messages : [
      {
        id: `msg-${session.id}`,
        role: 'model',
        text: `这是您此前的任务对话 **${session.title}**。\n\n提示词模板：\n场景描述：室外意大利阿马尔菲海岸/地中海沿海悬崖石桥阶梯风光。背景上方横跨着一座高耸古朴的半圆弧形古典石拱门。\n构图方式：全身环境人像景象 (Full-Length Environmental Portrait)。`,
        thinkingSummary: '已调取该历史对话的核心提示词参数与模型推演上下文。',
        timestamp: session.updatedAt,
      }
    ]);
    setUploadedImages([]);
  };

  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (activeSessionId === sessionId) {
      handleStartNewChat();
    }
  };

  const handleCloseConversation = () => {
    setShowOverflowMenu(false);
    setActiveSessionId(null);
  };

  const handleTogglePinSession = (sessionId: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, isPinned: !s.isPinned } : s))
    );
    setShowOverflowMenu(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const compressedFiles = await compressImageFiles(Array.from(e.target.files));
      compressedFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setUploadedImages((prev) => [...prev, reader.result as string].slice(-5));
          }
        };
        reader.readAsDataURL(file);
      });
      e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleReasoning = (msgId: string) => {
    setExpandedReasoning((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const handleSend = async (userTextToSend?: string, imagesToSend?: string[]) => {
    const textPrompt = (userTextToSend !== undefined ? userTextToSend : (activeSessionId ? chatInput : homeInput)).trim();
    const activeImages = imagesToSend !== undefined ? imagesToSend : uploadedImages;

    if ((!textPrompt && activeImages.length === 0) || isLoading) return;

    let currentId = activeSessionId;
    if (!currentId) {
      currentId = Date.now().toString();
      setActiveSessionId(currentId);
    }

    const userMessageId = `user-${Date.now()}`;
    const userMessage: SparkMessage = {
      id: userMessageId,
      role: 'user',
      text: textPrompt,
      images: activeImages.length > 0 ? [...activeImages] : undefined,
      timestamp: Date.now(),
    };

    const modelMessageId = `model-${Date.now()}`;
    const initialModelMessage: SparkMessage = {
      id: modelMessageId,
      role: 'model',
      text: '',
      thinkingSummary: '正在分析用户查询意图与核心需求，并进行 Preflight 自检推演...',
      isStreaming: true,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage, initialModelMessage]);
    setHomeInput('');
    setChatInput('');
    if (imagesToSend === undefined) setUploadedImages([]);
    setIsLoading(true);

    try {
      if (selectedModel === 'claude-code') {
        const claudeRes = await runClaudeCodeAgent(textPrompt, selectedPluginId);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === modelMessageId
              ? {
                  ...msg,
                  text: claudeRes.mainContent,
                  thinkingSummary: claudeRes.thinkingSummary || 'Claude Code 已完成 Preflight 参数与系统依赖推演。',
                  claudeCodePlan: claudeRes,
                  isStreaming: false,
                }
              : msg
          )
        );
      } else {
        const history = messages.map((m) => ({
          role: m.role,
          parts: [{ text: m.text }],
        }));

        let fullStreamed = '';
        await sendChatMessageStream(
          history,
          textPrompt,
          (_chunk, fullText) => {
            fullStreamed = fullText;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === modelMessageId
                  ? { ...msg, text: fullText, isStreaming: true }
                  : msg
              )
            );
          },
          {
            systemInstruction:
              'You are XcAI Spark Agent, powered by Claude Code Agentic principles. Provide ultra-clear, production-grade responses in beautifully formatted Simplified Chinese Markdown.',
          }
        );

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === modelMessageId
              ? {
                  ...msg,
                  text: fullStreamed,
                  thinkingSummary: '分析完成，已生成结构化决策与执行指令。',
                  isStreaming: false,
                }
              : msg
          )
        );
      }
    } catch (error: any) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === modelMessageId
            ? {
                ...msg,
                text: `⚠️ **请求出错了**：${error?.message || '未知连接错误，请稍后重试。'}`,
                thinkingSummary: '异常中断，已捕获错误跟踪栈。',
                isStreaming: false,
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const formatInlineStyles = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-amber-300">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} className="px-1.5 py-0.5 rounded bg-[#28292A] text-amber-300 font-mono text-[11px] border border-white/10">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  const renderTextParagraphs = (raw: string, keyPrefix: string) => {
    const lines = raw.split('\n');
    return lines.map((line, idx) => {
      const key = `${keyPrefix}-${idx}`;
      if (line.startsWith('# ')) {
        return (
          <h1 key={key} className="text-base font-black text-slate-100 mt-4 mb-2 border-b border-white/10 pb-1.5">
            {line.slice(2)}
          </h1>
        );
      }
      if (line.startsWith('## ')) {
        return (
          <h2 key={key} className="text-sm font-bold text-amber-300 mt-3 mb-1.5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            {line.slice(3)}
          </h2>
        );
      }
      if (line.startsWith('### ')) {
        return (
          <h3 key={key} className="text-xs font-bold text-purple-300 mt-2 mb-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
            {line.slice(4)}
          </h3>
        );
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <div key={key} className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed my-1 pl-2">
            <span className="text-amber-400 text-sm leading-none mt-0.5">•</span>
            <span className="flex-1">{formatInlineStyles(line.slice(2))}</span>
          </div>
        );
      }
      if (/^\d+\.\s/.test(line)) {
        const numMatch = line.match(/^(\d+)\.\s(.*)/);
        if (numMatch) {
          return (
            <div key={key} className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed my-1 pl-2">
              <span className="text-amber-400 font-mono text-[11px] font-bold shrink-0">{numMatch[1]}.</span>
              <span className="flex-1">{formatInlineStyles(numMatch[2])}</span>
            </div>
          );
        }
      }
      if (!line.trim()) return <div key={key} className="h-1.5" />;
      return (
        <p key={key} className="text-xs text-slate-200 leading-relaxed my-1">
          {formatInlineStyles(line)}
        </p>
      );
    });
  };

  const renderFormattedMarkdown = (text: string) => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      const precedingText = text.slice(lastIndex, match.index);
      if (precedingText) {
        parts.push(renderTextParagraphs(precedingText, `text-${lastIndex}`));
      }

      const lang = match[1] || 'code';
      const codeContent = match[2].trim();
      const codeId = `code-${match.index}`;

      parts.push(
        <div key={codeId} className="my-3 rounded-xl overflow-hidden border border-white/10 bg-[#18181A] shadow-xl">
          <div className="flex items-center justify-between px-3.5 py-2 bg-[#202124] border-b border-white/5 text-[11px] text-zinc-400 font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/80"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/80"></span>
              <span className="ml-1 font-bold text-amber-400 uppercase flex items-center gap-1">
                <Code2 className="w-3 h-3 text-amber-400" />
                {lang}
              </span>
            </div>
            <button
              onClick={() => handleCopyText(codeId, codeContent)}
              className="flex items-center gap-1 hover:text-white px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 transition-colors"
            >
              {copiedId === codeId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedId === codeId ? '已复制' : '复制代码'}</span>
            </button>
          </div>
          <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed">
            <code>{codeContent}</code>
          </pre>
        </div>
      );

      lastIndex = match.index + match[0].length;
    }

    const remainingText = text.slice(lastIndex);
    if (remainingText) {
      parts.push(renderTextParagraphs(remainingText, `text-${lastIndex}`));
    }

    return parts;
  };

  const activeModelObj = MODEL_OPTIONS.find((m) => m.id === selectedModel) || MODEL_OPTIONS[0];
  const activePluginObj = CLAUDE_CODE_PLUGINS.find((p) => p.id === selectedPluginId) || CLAUDE_CODE_PLUGINS[0];
  const activeSessionObj = sessions.find((s) => s.id === activeSessionId);
  const currentSessionTitle = activeSessionObj?.title || 'Nanobanana 服装复刻系统设置';
  const latestUserImage = messages.filter((m) => m.role === 'user' && m.images && m.images.length > 0).pop()?.images?.[0];

  return (
    <div className="h-screen w-full flex bg-[#131314] text-slate-200 font-sans overflow-hidden select-none relative">
      {/* 1. Leftmost Icon Ribbon & History Drawer */}
      <aside className="flex h-full shrink-0 z-30 border-r border-white/10 bg-[#1E1F20]/90 backdrop-blur-2xl transition-all duration-300">
        {/* Fixed Icon Ribbon */}
        <div className="w-14 h-full flex flex-col items-center justify-between py-4 border-r border-white/5 bg-[#131314]">
          <div className="flex flex-col items-center gap-5">
            {/* Gemini Multi-color Spark Icon */}
            <div
              onClick={handleStartNewChat}
              className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#4285F4] via-[#DB4437] to-[#F4B400] p-0.5 shadow-md flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
              title="XcAI Spark Agent 首页"
            >
              <div className="w-full h-full bg-[#131314] rounded-[14px] flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
              </div>
            </div>

            {/* Sidebar Toggle Button */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
              title={isSidebarOpen ? '收起侧边栏' : '展开侧边栏'}
            >
              {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>

            {/* Quick Actions */}
            <button
              onClick={handleStartNewChat}
              className="p-2 rounded-xl text-zinc-400 hover:text-amber-400 hover:bg-white/10 transition-all"
              title="描述新任务"
            >
              <Plus className="w-4 h-4" />
            </button>

            <button className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all" title="近期历史">
              <Clock className="w-4 h-4" />
            </button>

            <button
              onClick={() => setSelectedModel('claude-code')}
              className={`p-2 rounded-xl transition-all ${selectedModel === 'claude-code' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'text-zinc-400 hover:text-purple-400 hover:bg-white/10'}`}
              title="切换至 Claude Code Agent"
            >
              <Terminal className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
              title="设置"
            >
              <Settings className="w-4 h-4" />
            </button>
            <div className="w-7 h-7 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center text-[10px] font-black text-white shadow-md">
              YC
            </div>
          </div>
        </div>

        {/* Expandable Recent Sessions Panel */}
        {isSidebarOpen && (
          <div className="w-64 h-full p-4 flex flex-col justify-between overflow-y-auto bg-[#1E1F20]">
            <div>
              {/* Top Task Start Pill Button */}
              <button
                onClick={handleStartNewChat}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-white/10 to-white/5 hover:from-white/15 hover:to-white/10 border border-white/10 text-xs font-bold text-slate-100 shadow-lg transition-all active:scale-98 mb-6"
              >
                <Plus className="w-4 h-4 text-amber-400" />
                <span>描述任务</span>
              </button>

              {/* Recent Section Subtitle */}
              <div className="flex items-center justify-between px-2 mb-3">
                <span className="text-xs font-bold text-zinc-400 flex items-center gap-1">
                  近期 <ChevronDown className="w-3 h-3 text-zinc-500" />
                </span>
                <span className="text-[10px] text-zinc-500">{sessions.length} 个记录</span>
              </div>

              {/* Sessions List */}
              <div className="space-y-2">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => handleSelectSession(s)}
                    className={`group relative flex flex-col gap-1 p-3 rounded-2xl cursor-pointer transition-all ${
                      activeSessionId === s.id
                        ? 'bg-[#28292A] text-amber-300 font-bold border border-white/10 shadow-md'
                        : 'text-zinc-400 hover:bg-white/5 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="truncate text-xs font-bold text-slate-100">{s.title}</p>
                      <button
                        onClick={(e) => handleDeleteSession(e, s.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400 transition-opacity"
                        title="删除对话"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    {s.excerpt && (
                      <p className="text-[10px] text-zinc-500 truncate leading-relaxed">{s.excerpt}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Claude Code Repo Badge */}
            <div className="pt-4 border-t border-white/5 space-y-1.5">
              <a
                href="https://github.com/xiaoche0907/claude-code.git"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-[10px] text-purple-300 hover:text-purple-200 font-bold bg-purple-950/30 p-2 rounded-xl border border-purple-500/20"
              >
                <Github className="w-3 h-3 text-purple-400" />
                <span className="truncate">claude-code.git</span>
                <span className="text-[9px] px-1 bg-purple-500/30 text-purple-200 rounded font-black shrink-0">已搭载</span>
              </a>
            </div>
          </div>
        )}
      </aside>

      {/* 2. Main Area: Render EMPTY HOME VIEW (Image 2) OR ACTIVE CONVERSATION (Image 1) */}
      {!activeSessionId ? (
        /* ==================== 2A. EMPTY SPARK HOME VIEW (IMAGE 2) ==================== */
        <div className="flex-1 flex flex-col h-full bg-[#131314] relative overflow-y-auto">
          {/* Top Right Header Pill */}
          <div className="absolute top-6 right-8 z-20 flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-zinc-300 transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              返回主站
            </button>
            <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-zinc-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              新功能 • BETA 版
            </span>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-3xl mx-auto w-full py-16">
            {/* Centered Hero Title */}
            <h1 className="text-3xl font-black tracking-wide text-slate-100 mb-8 text-center bg-gradient-to-r from-slate-100 via-zinc-200 to-amber-200 bg-clip-text text-transparent">
              让 Gemini Spark 为你服务
            </h1>

            {/* Centered Search Pill Input */}
            <div className="w-full relative mb-12">
              <div className="w-full bg-[#1E1F20] hover:bg-[#252627] border border-white/15 focus-within:border-amber-500/50 rounded-full py-3.5 px-6 flex items-center justify-between shadow-2xl transition-all">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-slate-100 transition-colors"
                >
                  <Plus className="w-4 h-4 text-amber-400" />
                  <span>描述任务</span>
                </button>

                <input
                  type="text"
                  value={homeInput}
                  onChange={(e) => setHomeInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder=""
                  className="flex-1 bg-transparent outline-none text-slate-100 text-sm px-4 font-medium"
                />

                <div className="flex items-center gap-3">
                  <Mic className="w-4 h-4 text-zinc-500 hover:text-zinc-300 cursor-pointer" />
                  <button
                    onClick={() => handleSend()}
                    className="w-8 h-8 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Uploaded image previews if present */}
              {uploadedImages.length > 0 && (
                <div className="flex gap-2 mt-3 px-4">
                  {uploadedImages.map((img, idx) => (
                    <div key={idx} className="relative w-12 h-12 rounded-lg overflow-hidden border border-white/20">
                      <img src={img} alt="preview" className="w-full h-full object-cover" />
                      <button onClick={() => removeImage(idx)} className="absolute inset-0 bg-black/60 flex items-center justify-center text-white">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Section Cards */}
            <div className="w-full max-w-2xl space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-zinc-400 flex items-center gap-1">
                  近期 <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                </span>
              </div>

              <div className="space-y-3">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => handleSelectSession(s)}
                    className="group flex flex-col p-4 rounded-2xl bg-[#1E1F20] hover:bg-[#28292A] border border-white/5 hover:border-white/15 cursor-pointer transition-all shadow-md"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-xs font-bold text-slate-100 group-hover:text-amber-300 transition-colors">
                        {s.title}
                      </h3>
                      <span className="text-[10px] text-zinc-500">
                        {Math.round((Date.now() - s.updatedAt) / 3600000)}小时前
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed truncate">
                      {s.excerpt || '包含了可执行的结构化指示词与参数策略。'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ==================== 2B. ACTIVE CONVERSATION VIEW (IMAGE 1) ==================== */
        <div className="flex-1 flex flex-col h-full min-w-0 bg-[#131314] relative">
          {/* Top Header Bar */}
          <header className="h-14 shrink-0 border-b border-white/10 bg-[#1E1F20]/70 backdrop-blur-xl px-6 flex items-center justify-between z-20">
            <div className="flex items-center gap-4 min-w-0">
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-zinc-300 transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                返回首页
              </button>

              <div className="h-4 w-px bg-white/10"></div>

              <h2 className="text-xs font-bold text-slate-100 truncate max-w-sm">
                {currentSessionTitle}
              </h2>

              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-black uppercase">
                  BETA 版
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold">
                  完成
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Model Selector Pill */}
              <div className="relative">
                <button
                  onClick={() => setShowModelDropdown(!showModelDropdown)}
                  className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-zinc-200 transition-all"
                >
                  <Brain className="w-3.5 h-3.5 text-amber-400" />
                  <span>{activeModelObj.name}</span>
                  <ChevronDown className="w-3 h-3 text-zinc-400" />
                </button>

                {showModelDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowModelDropdown(false)}></div>
                    <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-white/15 bg-zinc-900/95 p-2 shadow-2xl backdrop-blur-2xl z-50 animate-in fade-in slide-in-from-top-2">
                      <p className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-zinc-500">选择 Agent 模型</p>
                      {MODEL_OPTIONS.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => {
                            setSelectedModel(model.id);
                            setShowModelDropdown(false);
                          }}
                          className={`w-full flex flex-col gap-0.5 px-3 py-2 rounded-xl transition-all text-left ${
                            selectedModel === model.id ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300' : 'hover:bg-white/5 text-zinc-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold">{model.name}</span>
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-white/10 text-zinc-400">{model.badge}</span>
                          </div>
                          <span className="text-[10px] text-zinc-500">{model.desc}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Overflow Menu (⋮ Button in Image 1) */}
              <div className="relative">
                <button
                  onClick={() => setShowOverflowMenu(!showOverflowMenu)}
                  className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
                  title="更多选项"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {showOverflowMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowOverflowMenu(false)}></div>
                    <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl border border-white/15 bg-[#1E1F20] p-1.5 shadow-2xl backdrop-blur-2xl z-50 animate-in fade-in slide-in-from-top-2 space-y-0.5">
                      <button
                        onClick={() => {
                          setShowOverflowMenu(false);
                          const newName = prompt('重命名此对话：', currentSessionTitle);
                          if (newName && activeSessionId) {
                            setSessions((prev) =>
                              prev.map((s) => (s.id === activeSessionId ? { ...s, title: newName } : s))
                            );
                          }
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-zinc-300 hover:bg-white/10 hover:text-white transition-all text-left"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                        <span>重命名</span>
                      </button>

                      <button
                        onClick={() => activeSessionId && handleTogglePinSession(activeSessionId)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-zinc-300 hover:bg-white/10 hover:text-white transition-all text-left"
                      >
                        <Pin className="w-3.5 h-3.5 text-blue-400" />
                        <span>{activeSessionObj?.isPinned ? '取消固定' : '固定'}</span>
                      </button>

                      <button
                        onClick={() => activeSessionId && handleDeleteSession({ stopPropagation: () => {} } as any, activeSessionId)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 transition-all text-left"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>删除</span>
                      </button>

                      <div className="my-1 border-t border-white/5"></div>

                      <button
                        onClick={handleCloseConversation}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-100 hover:bg-white/10 transition-all text-left"
                      >
                        <X className="w-3.5 h-3.5 text-zinc-400" />
                        <span>关闭对话</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          {/* Claude Code Active Banner */}
          {selectedModel === 'claude-code' && (
            <div className="bg-gradient-to-r from-purple-950/60 via-violet-950/40 to-black/60 border-b border-purple-500/30 px-6 py-2 flex items-center justify-between z-10">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-200">
                <Terminal className="w-4 h-4 text-purple-400" />
                <span>已搭载 claude-code Agent 引擎</span>
                <span className="text-[10px] text-purple-300/80 font-normal">| Planning Mode & Preflight Check 生效中</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                  预设: {activePluginObj.name}
                </span>
              </div>
            </div>
          )}

          {/* Main Conversation Stream */}
          <main ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            <div className="max-w-4xl mx-auto space-y-6">
              {messages.map((msg) => (
                <div key={msg.id} className="space-y-3">
                  {/* User Message */}
                  {msg.role === 'user' && (
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">YOU</span>
                      </div>
                      <div className="flex items-start gap-3 max-w-xl bg-gradient-to-r from-amber-600/20 to-orange-600/20 border border-amber-500/30 rounded-2xl rounded-tr-none p-4 text-xs leading-relaxed text-slate-100 shadow-md">
                        {msg.images && msg.images.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 shrink-0">
                            {msg.images.map((img, i) => (
                              <img key={i} src={img} alt="user upload" className="w-12 h-12 object-cover rounded-lg border border-white/20" />
                            ))}
                          </div>
                        )}
                        <p className="flex-1">{msg.text}</p>
                      </div>
                    </div>
                  )}

                  {/* Model Assistant Message */}
                  {msg.role === 'model' && (
                    <div className="flex flex-col items-start w-full">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-amber-500 to-purple-600 flex items-center justify-center shadow-md">
                          <Sparkles className="w-3 h-3 text-white" />
                        </div>
                        <span className="text-[10px] font-bold text-amber-400">XcAI Spark Agent</span>
                      </div>

                      <div className="w-full bg-[#1E1F20] border border-white/10 rounded-2xl rounded-tl-none p-5 shadow-xl space-y-4">
                        {/* Collapsible Intent Rationale Accordion (Gemini Spark Feature - Image 1) */}
                        {msg.thinkingSummary && (
                          <div className="rounded-xl bg-black/40 border border-white/5 p-2.5">
                            <button
                              onClick={() => toggleReasoning(msg.id)}
                              className="w-full flex items-center justify-between text-[11px] font-bold text-zinc-400 hover:text-amber-300 transition-colors"
                            >
                              <span className="flex items-center gap-1.5">
                                <Brain className="w-3.5 h-3.5 text-amber-400" />
                                分析用户查询意图与核心需求
                              </span>
                              {expandedReasoning[msg.id] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                            {expandedReasoning[msg.id] && (
                              <p className="mt-2 text-[11px] leading-relaxed text-zinc-300 pl-5 border-l border-amber-500/30">
                                {msg.thinkingSummary}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Claude Code Agent Task Card */}
                        {msg.claudeCodePlan && (
                          <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-3 space-y-2">
                            <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2">
                              <div className="flex items-center gap-2">
                                <Terminal className="w-4 h-4 text-purple-400" />
                                <span className="font-bold text-purple-300">Claude Code Task Planning</span>
                              </div>
                              <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full font-bold flex items-center gap-1 border border-emerald-500/30">
                                <ShieldCheck className="w-3 h-3" /> Preflight Passed
                              </span>
                            </div>
                            {msg.claudeCodePlan.steps.map((s) => (
                              <div key={s.index} className="text-[11px] flex items-center gap-2 text-zinc-300 bg-black/30 p-2 rounded-lg border border-white/5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span className="font-bold text-slate-100">{s.title}</span>
                                {s.description && <span className="text-zinc-400 text-[10px]">- {s.description}</span>}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Main Enhanced Markdown Body */}
                        <div className="prose prose-invert max-w-none">
                          {renderFormattedMarkdown(msg.text)}
                        </div>

                        {/* Streaming Indicator */}
                        {msg.isStreaming && (
                          <span className="inline-block w-2 h-4 bg-amber-400 animate-pulse ml-1 align-middle rounded"></span>
                        )}

                        {/* Copy Action Footer */}
                        {!msg.isStreaming && msg.text && (
                          <div className="flex items-center justify-end pt-2 border-t border-white/5">
                            <button
                              onClick={() => handleCopyText(msg.id, msg.text)}
                              className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 hover:text-white px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-all"
                            >
                              {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedId === msg.id ? '已复制' : '复制回答'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </main>

          {/* Bottom Floating Composer Pill (Gemini Spark Style - Image 1) */}
          <footer className="p-4 bg-[#131314] border-t border-white/10 shrink-0">
            <div className="max-w-3xl mx-auto space-y-2">
              {/* Uploaded Images Strip */}
              {uploadedImages.length > 0 && (
                <div className="flex gap-2 p-2 rounded-xl bg-[#1E1F20] border border-white/10 overflow-x-auto">
                  {uploadedImages.map((img, idx) => (
                    <div key={idx} className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden border border-white/20 group">
                      <img src={img} alt="preview" className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeImage(idx)}
                        className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Gemini Spark Task Input Pill */}
              <div className="relative rounded-2xl border border-white/15 bg-[#1E1F20] shadow-2xl p-2.5 flex flex-col gap-2 focus-within:ring-2 focus-within:ring-amber-500/40 transition-all">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={selectedModel === 'claude-code' ? '询问 Claude Code Agent 或进行 Task Planning 任务拆解...' : '接下来要做些什么？'}
                  className="w-full bg-transparent outline-none text-slate-100 text-xs px-2 py-1 min-h-[42px] max-h-[140px] resize-none placeholder-zinc-500"
                ></textarea>

                <div className="flex items-center justify-between pt-1.5 border-t border-white/5 px-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      multiple
                      accept="image/*"
                      className="hidden"
                    />
                    
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-zinc-300 transition-all"
                      title="上传参考图"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-400" />
                      <span>图片 ({uploadedImages.length}/5)</span>
                    </button>

                    {/* Plugin Selector Dropdown when in Claude Code mode */}
                    {selectedModel === 'claude-code' && (
                      <div className="relative">
                        <button
                          onClick={() => setShowPluginDropdown(!showPluginDropdown)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-[11px] font-bold text-purple-300 transition-all"
                        >
                          <Zap className="w-3 h-3" />
                          <span>预设: {activePluginObj.badge}</span>
                        </button>

                        {showPluginDropdown && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowPluginDropdown(false)}></div>
                            <div className="absolute left-0 bottom-full mb-2 w-64 rounded-2xl border border-white/15 bg-zinc-900/95 p-2 shadow-2xl backdrop-blur-2xl z-50">
                              <p className="px-3 py-1 text-[10px] font-black uppercase text-zinc-500">Claude Code 插件选择</p>
                              {CLAUDE_CODE_PLUGINS.map((plugin) => (
                                <button
                                  key={plugin.id}
                                  onClick={() => {
                                    setSelectedPluginId(plugin.id);
                                    setShowPluginDropdown(false);
                                  }}
                                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                                    selectedPluginId === plugin.id ? 'bg-purple-500/20 text-purple-300' : 'text-zinc-300 hover:bg-white/5'
                                  }`}
                                >
                                  {plugin.name}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button className="p-1.5 rounded-xl text-zinc-500 hover:text-zinc-300 transition-all" title="语音输入">
                      <Mic className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleSend()}
                      disabled={(!chatInput.trim() && uploadedImages.length === 0) || isLoading}
                      className="w-8 h-8 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white flex items-center justify-center shadow-md transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                    >
                      {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-center text-zinc-500">
                Gemini 是一款 AI 工具，其回答未必准确无误。
              </p>
            </div>
          </footer>
        </div>
      )}

      {/* Settings Modal */}
      <UnifiedSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        initialTab="model"
      />
    </div>
  );
};
