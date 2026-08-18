import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, Brain, ArrowLeft, Send, Image as ImageIcon, X, Copy, Check,
  ShieldCheck, Loader2, Settings, Zap, ChevronDown, ChevronRight, Clock, Bookmark,
  Terminal, MoreVertical, Plus, Mic, PanelLeftClose, PanelLeftOpen, Trash2, Edit3
} from 'lucide-react';
import { sendChatMessageStream, urlToBase64 } from '../XcAISTUDIO-main/services/geminiService';
import {
  runClaudeCodeAgent,
  CLAUDE_CODE_PLUGINS,
  type ClaudeCodeAgentResponse,
} from '../XcAISTUDIO-main/services/claudeCodeAgent';
import { compressImageFiles } from '../Cyzx4/utils/imageCompressor';
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
  messages: SparkMessage[];
  updatedAt: number;
}

interface SparkChatStudioProps {
  initialInput?: string;
  initialImages?: string[];
  initialModel?: string;
  onBack: () => void;
}

const MODEL_OPTIONS = [
  { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', badge: '默认/推荐', desc: '全维度智能推理与逻辑生成' },
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', badge: 'Fast', desc: '极速响应与商业图文规划' },
  { id: 'grok-4.6', name: 'Grok 4.6', badge: 'New', desc: '跨领域实时大语言推理' },
  { id: 'claude-opus-5', name: 'Claude Opus 5', badge: 'Pro', desc: '高阶复杂推理与商业策略' },
  { id: 'claude-code', name: 'Claude Code Agent', badge: '⚡ Agentic', desc: '深度 Task Planning 与 Preflight 自检' },
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
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    return Date.now().toString();
  });

  const [messages, setMessages] = useState<SparkMessage[]>([]);
  const [input, setInput] = useState('');
  const [uploadedImages, setUploadedImages] = useState<string[]>(initialImages);
  const [selectedModel, setSelectedModel] = useState<string>(initialModel);
  const [selectedPluginId, setSelectedPluginId] = useState<string>('frontend-design');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showPluginDropdown, setShowPluginDropdown] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({});

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

  // Persist sessions to local storage
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('spark_agent_sessions', JSON.stringify(sessions.slice(0, 30)));
    }
  }, [sessions]);

  // Save current active session messages to sessions list
  useEffect(() => {
    if (messages.length === 0) return;
    setSessions((prev) => {
      const titleCandidate = messages.find((m) => m.role === 'user')?.text || '未命名任务对话';
      const title = titleCandidate.slice(0, 18) + (titleCandidate.length > 18 ? '...' : '');
      const existingIdx = prev.findIndex((s) => s.id === currentSessionId);
      const updatedSession: SparkSession = {
        id: currentSessionId,
        title,
        messages,
        updatedAt: Date.now(),
      };

      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = updatedSession;
        return next;
      }
      return [updatedSession, ...prev];
    });
  }, [messages, currentSessionId]);

  // Handle Initial User Input from Homepage
  useEffect(() => {
    if (initialProcessedRef.current) return;
    initialProcessedRef.current = true;

    if (initialInput.trim() || initialImages.length > 0) {
      void handleSend(initialInput, initialImages);
    } else {
      setMessages([
        {
          id: 'welcome-msg',
          role: 'model',
          text: '你好！我是 **XcAI Spark Agent**。无论是商业视觉创意策划、品牌主图拆解，还是搭载 **Claude Code Agent** 进行深度任务拆解，请随时告诉我！',
          thinkingSummary: '根据系统预设初值，已完成视觉策划与代码智能力场环境校验。',
          timestamp: Date.now(),
        },
      ]);
    }
  }, []);

  const handleStartNewChat = () => {
    const newId = Date.now().toString();
    setCurrentSessionId(newId);
    setMessages([
      {
        id: `welcome-${newId}`,
        role: 'model',
        text: '你好！我是 **XcAI Spark Agent**。请随时在下方描述您的任务或发送需求！',
        timestamp: Date.now(),
      },
    ]);
    setUploadedImages([]);
    setInput('');
  };

  const handleSelectSession = (session: SparkSession) => {
    setCurrentSessionId(session.id);
    setMessages(session.messages);
    setUploadedImages([]);
  };

  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (currentSessionId === sessionId) {
      handleStartNewChat();
    }
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
    const textPrompt = (userTextToSend !== undefined ? userTextToSend : input).trim();
    const activeImages = imagesToSend !== undefined ? imagesToSend : uploadedImages;

    if ((!textPrompt && activeImages.length === 0) || isLoading) return;

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
      thinkingSummary: '正在分析用户查询意图与核心需求，并规划最优渲染逻辑...',
      isStreaming: true,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage, initialModelMessage]);
    if (userTextToSend === undefined) setInput('');
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
                  thinkingSummary: claudeRes.thinkingSummary || '已完成 Preflight 环境依赖检查与 Task Planning 指令推演。',
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
              'You are XcAI Spark Agent, an elite AI creative director & engineering assistant. Provide ultra-clear, production-grade responses in beautifully formatted Simplified Chinese Markdown.',
          }
        );

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === modelMessageId
              ? {
                  ...msg,
                  text: fullStreamed,
                  thinkingSummary: '分析完成，已成功生成可落地的结构化规划与构图指导方案。',
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
                thinkingSummary: '解析链路中断，已捕获异常。',
                isStreaming: false,
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const renderFormattedMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const key = `line-${idx}`;
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
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <div key={key} className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed my-1 pl-2">
            <span className="text-amber-400 text-sm leading-none mt-0.5">•</span>
            <span className="flex-1">{line.slice(2)}</span>
          </div>
        );
      }
      if (/^\d+\.\s/.test(line)) {
        const numMatch = line.match(/^(\d+)\.\s(.*)/);
        if (numMatch) {
          return (
            <div key={key} className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed my-1 pl-2">
              <span className="text-amber-400 font-mono text-[11px] font-bold shrink-0">{numMatch[1]}.</span>
              <span className="flex-1">{numMatch[2]}</span>
            </div>
          );
        }
      }
      if (!line.trim()) return <div key={key} className="h-1.5" />;
      return (
        <p key={key} className="text-xs text-slate-200 leading-relaxed my-1">
          {line}
        </p>
      );
    });
  };

  const activeModelObj = MODEL_OPTIONS.find((m) => m.id === selectedModel) || MODEL_OPTIONS[0];
  const currentSessionTitle = sessions.find((s) => s.id === currentSessionId)?.title || '通用智能创意策划';
  const latestUserImage = messages.filter((m) => m.role === 'user' && m.images && m.images.length > 0).pop()?.images?.[0];

  return (
    <div className="h-screen w-full flex bg-[#131314] text-slate-200 font-sans overflow-hidden select-none">
      {/* 1. Leftmost Icon Ribbon & History Drawer */}
      <aside className="flex h-full shrink-0 z-30 border-r border-white/10 bg-[#1E1F20]/90 backdrop-blur-2xl transition-all duration-300">
        {/* Fixed Icon Ribbon */}
        <div className="w-14 h-full flex flex-col items-center justify-between py-4 border-r border-white/5 bg-[#131314]">
          <div className="flex flex-col items-center gap-5">
            {/* Gemini Multi-color Spark Icon */}
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#4285F4] via-[#DB4437] to-[#F4B400] p-0.5 shadow-md flex items-center justify-center cursor-pointer hover:scale-105 transition-transform" title="XcAI Spark">
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

            <button className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all" title="已标记与书签">
              <Bookmark className="w-4 h-4" />
            </button>

            <button className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all" title="Claude Code Agent">
              <Terminal className="w-4 h-4 text-purple-400" />
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
              <div className="space-y-1.5">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => handleSelectSession(s)}
                    className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all text-xs font-medium ${
                      currentSessionId === s.id
                        ? 'bg-[#28292A] text-amber-300 font-bold border border-white/10 shadow-sm'
                        : 'text-zinc-400 hover:bg-white/5 hover:text-slate-200'
                    }`}
                  >
                    <div className="min-w-0 flex-1 truncate pr-2">
                      <p className="truncate text-xs">{s.title}</p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSession(e, s.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400 transition-opacity"
                      title="删除对话"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-500">
              <span>Gemini Spark 引擎</span>
              <span className="text-emerald-400 font-mono text-[10px]">• Ready</span>
            </div>
          </div>
        )}
      </aside>

      {/* 2. Main Right Workspace */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-[#131314] relative">
        {/* Top Navigation Bar */}
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

            {/* Session Reference Thumbnail */}
            {latestUserImage && (
              <img
                src={latestUserImage}
                alt="Uploaded reference"
                className="w-8 h-8 rounded-lg object-cover border border-white/20 shadow-md"
              />
            )}
          </div>
        </header>

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
                      {/* Collapsible Intent Rationale Accordion (Gemini Spark Feature) */}
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
                            <span className="font-bold text-purple-300">⚡ Claude Code Task Planning</span>
                            <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full font-bold">Preflight Passed</span>
                          </div>
                          {msg.claudeCodePlan.steps.map((s) => (
                            <div key={s.index} className="text-[11px] flex items-center gap-2 text-zinc-300">
                              <span className="text-emerald-400 font-bold">✓ Step {s.index}:</span>
                              <span>{s.title}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Main Markdown Body */}
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

        {/* Bottom Floating Composer Pill (Gemini Spark Style) */}
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
            <div className="relative rounded-2xl border border-white/15 bg-[#1E1F20] shadow-2xl p-2 flex items-center gap-3 focus-within:ring-2 focus-within:ring-amber-500/40 transition-all">
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
                className="p-2 rounded-xl text-zinc-400 hover:text-amber-400 hover:bg-white/10 transition-all shrink-0"
                title="上传参考图"
              >
                <Plus className="w-4 h-4" />
              </button>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="接下来要做些什么？"
                className="flex-1 bg-transparent outline-none text-slate-100 text-xs px-1 py-1 min-h-[36px] max-h-[120px] resize-none placeholder-zinc-500"
              ></textarea>

              <div className="flex items-center gap-2 shrink-0">
                <button className="p-2 rounded-xl text-zinc-500 hover:text-zinc-300 transition-all" title="语音输入">
                  <Mic className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleSend()}
                  disabled={(!input.trim() && uploadedImages.length === 0) || isLoading}
                  className="w-8 h-8 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white flex items-center justify-center shadow-md transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                >
                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <p className="text-[10px] text-center text-zinc-500">
              Gemini 是一款 AI 工具，其回答未必准确无误。
            </p>
          </div>
        </footer>

        {/* Settings Modal */}
        <UnifiedSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          initialTab="model"
        />
      </div>
    </div>
  );
};
