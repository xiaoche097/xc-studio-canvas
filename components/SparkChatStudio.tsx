import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, Brain, ArrowLeft, Send, Image as ImageIcon, X, Copy, Check,
  ShieldCheck, Loader2, RefreshCw, Trash2, Plus, Settings, Zap, Globe, MessageSquare, ChevronDown
} from 'lucide-react';
import { sendChatMessageStream, urlToBase64 } from '../XcAISTUDIO-main/services/geminiService';
import {
  runClaudeCodeAgent,
  CLAUDE_CODE_PLUGINS,
  type ClaudeCodeAgentResponse,
} from '../XcAISTUDIO-main/services/claudeCodeAgent';
import { compressImageFiles } from '../Cyzx4/utils/imageCompressor';
import { UnifiedSettingsModal } from './UnifiedSettingsModal';

interface SparkMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  images?: string[];
  claudeCodePlan?: ClaudeCodeAgentResponse;
  isStreaming?: boolean;
  timestamp: number;
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
          text: '你好！我是 **XcAI Spark Agent**。无论是商业视觉创意策划、品牌主图拆解，还是搭载 **Claude Code Agent** 进行深度任务规划，请随时告诉我！',
          timestamp: Date.now(),
        },
      ]);
    }
  }, []);

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
              ? { ...msg, text: fullStreamed, isStreaming: false }
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
          <h1 key={key} className="text-xl font-black text-white mt-4 mb-2 border-b border-white/10 pb-2">
            {line.slice(2)}
          </h1>
        );
      }
      if (line.startsWith('## ')) {
        return (
          <h2 key={key} className="text-lg font-bold text-amber-300 mt-3 mb-1.5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            {line.slice(3)}
          </h2>
        );
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <div key={key} className="flex items-start gap-2 text-sm text-zinc-300 leading-relaxed my-1 pl-2">
            <span className="text-brand-orange text-base leading-none mt-0.5">•</span>
            <span className="flex-1">{line.slice(2)}</span>
          </div>
        );
      }
      if (/^\d+\.\s/.test(line)) {
        const numMatch = line.match(/^(\d+)\.\s(.*)/);
        if (numMatch) {
          return (
            <div key={key} className="flex items-start gap-2 text-sm text-zinc-300 leading-relaxed my-1 pl-2">
              <span className="text-amber-400 font-mono text-xs font-bold shrink-0">{numMatch[1]}.</span>
              <span className="flex-1">{numMatch[2]}</span>
            </div>
          );
        }
      }
      if (!line.trim()) return <div key={key} className="h-2" />;
      return (
        <p key={key} className="text-sm text-zinc-200 leading-relaxed my-1.5">
          {line}
        </p>
      );
    });
  };

  const activeModelObj = MODEL_OPTIONS.find((m) => m.id === selectedModel) || MODEL_OPTIONS[0];

  return (
    <div className="h-screen w-full flex flex-col bg-[#08090C] text-slate-100 font-sans overflow-hidden relative">
      {/* Background Gradients & Ambient Spark Effects */}
      <div className="fixed top-0 left-0 w-full h-full opacity-30 pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
      <div className="fixed -top-[20%] left-[30%] w-[600px] h-[600px] bg-purple-600/10 blur-[150px] rounded-full pointer-events-none"></div>
      <div className="fixed top-[40%] right-[10%] w-[500px] h-[500px] bg-amber-500/10 blur-[150px] rounded-full pointer-events-none"></div>

      {/* Top Header Bar */}
      <header className="relative z-30 h-16 shrink-0 border-b border-white/10 bg-black/40 backdrop-blur-xl px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-zinc-300 transition-all hover:scale-105"
          >
            <ArrowLeft className="w-4 h-4" />
            返回首页
          </button>

          <div className="h-5 w-px bg-white/10"></div>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Sparkles className="w-4 h-4 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-wide text-white flex items-center gap-2">
                XcAI Spark <span className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-purple-500/20 border border-amber-500/30 text-amber-300 font-bold">Immersive Mode</span>
              </h1>
            </div>
          </div>
        </div>

        {/* Top Controls: Model Selector & Settings */}
        <div className="flex items-center gap-3">
          {/* Model Selector Pill */}
          <div className="relative">
            <button
              onClick={() => setShowModelDropdown(!showModelDropdown)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-zinc-200 transition-all"
            >
              <Brain className="w-3.5 h-3.5 text-amber-400" />
              <span>{activeModelObj.name}</span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
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
                      className={`w-full flex flex-col gap-0.5 px-3 py-2.5 rounded-xl transition-all text-left ${
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

          {/* Settings Button */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white transition-all"
            title="模型与节点配置"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Conversation Stream */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto relative z-10 px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-3 duration-300`}
            >
              {/* Message Header Badge */}
              <div className="flex items-center gap-2 mb-1.5 px-1">
                {msg.role === 'user' ? (
                  <span className="text-[10px] font-black text-zinc-500 tracking-wider uppercase">YOU</span>
                ) : (
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400">
                    <Sparkles className="w-3 h-3" />
                    <span>XcAI Spark</span>
                  </div>
                )}
              </div>

              {/* Message Content Container */}
              <div
                className={`relative group max-w-full rounded-2xl p-5 shadow-xl transition-all ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-amber-600/30 to-orange-600/30 border border-amber-500/30 text-white rounded-tr-none'
                    : 'bg-zinc-900/80 border border-white/10 text-zinc-100 rounded-tl-none backdrop-blur-xl w-full'
                }`}
              >
                {/* Uploaded User Images Preview */}
                {msg.images && msg.images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {msg.images.map((img, idx) => (
                      <img
                        key={idx}
                        src={img}
                        alt="Uploaded preview"
                        className="w-20 h-20 object-cover rounded-xl border border-white/20 shadow-md"
                      />
                    ))}
                  </div>
                )}

                {/* Claude Code Agent Plan Card View */}
                {msg.claudeCodePlan && (
                  <div className="mb-4 rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-950/40 via-violet-950/25 to-black/50 p-4 shadow-xl backdrop-blur-md">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-500/20 text-purple-300 border border-purple-400/30 font-black text-xs">
                          ⚡
                        </span>
                        <strong className="text-xs font-black text-purple-200">
                          Claude Code Agent · {msg.claudeCodePlan.intent}
                        </strong>
                      </div>
                      <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5" /> Preflight Passed
                      </span>
                    </div>

                    {msg.claudeCodePlan.thinkingSummary && (
                      <p className="mt-2.5 text-xs leading-5 text-purple-200/90 font-medium bg-purple-900/20 rounded-xl p-2.5 border border-purple-500/20">
                        💡 <strong>Thinking Rationale:</strong> {msg.claudeCodePlan.thinkingSummary}
                      </p>
                    )}

                    {msg.claudeCodePlan.steps.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 block mb-1">
                          Task Planning & Execution Steps
                        </span>
                        {msg.claudeCodePlan.steps.map((step) => (
                          <div key={step.index} className="flex items-start gap-2 text-xs bg-black/30 rounded-xl p-2.5 border border-white/5">
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-[10px] font-bold text-emerald-300 mt-0.5 border border-emerald-500/30">
                              ✓
                            </span>
                            <div className="min-w-0 flex-1">
                              <strong className="text-zinc-100 font-bold">{step.title}</strong>
                              {step.description && (
                                <span className="ml-2 text-zinc-400 text-[11px]">{step.description}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Main Body Text */}
                <div className="prose prose-invert max-w-none text-sm leading-relaxed">
                  {renderFormattedMarkdown(msg.text)}
                </div>

                {/* Streaming Indicator Pulse */}
                {msg.isStreaming && (
                  <span className="inline-block w-2 h-4 bg-amber-400 animate-pulse ml-1 align-middle rounded"></span>
                )}

                {/* Copy Button */}
                {!msg.isStreaming && msg.text && (
                  <div className="mt-3 flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleCopyText(msg.id, msg.text)}
                      className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 hover:text-white px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
                    >
                      {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedId === msg.id ? '已复制' : '复制内容'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Floating Bottom Input Dock */}
      <footer className="relative z-30 p-4 border-t border-white/10 bg-black/60 backdrop-blur-2xl">
        <div className="max-w-3xl mx-auto flex flex-col gap-2">
          {/* Uploaded Images Strip */}
          {uploadedImages.length > 0 && (
            <div className="flex gap-2 p-2 rounded-xl bg-zinc-900/90 border border-white/10 overflow-x-auto">
              {uploadedImages.map((img, idx) => (
                <div key={idx} className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden border border-white/20 group">
                  <img src={img} alt="preview" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Main Input Composer Box */}
          <div className="relative rounded-2xl border border-white/15 bg-zinc-900/90 shadow-2xl p-2.5 focus-within:ring-2 focus-within:ring-amber-500/40 transition-all">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={selectedModel === 'claude-code' ? '询问 Claude Code Agent 或进行 Task Planning 任务拆解...' : '描述您的商业创意需求或发送问题...'}
              className="w-full bg-transparent outline-none text-zinc-100 text-sm px-3 py-2 min-h-[56px] max-h-[160px] resize-none placeholder-zinc-500"
            ></textarea>

            {/* Bottom Bar Tools */}
            <div className="flex items-center justify-between px-2 pt-1 border-t border-white/5">
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
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-zinc-300 transition-all"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                  <span>图片 ({uploadedImages.length}/5)</span>
                </button>

                {/* Plugin selector when in Claude Code mode */}
                {selectedModel === 'claude-code' && (
                  <div className="relative">
                    <button
                      onClick={() => setShowPluginDropdown(!showPluginDropdown)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-xs font-bold text-purple-300 transition-all"
                    >
                      <Zap className="w-3 h-3" />
                      <span>{CLAUDE_CODE_PLUGINS.find((p) => p.id === selectedPluginId)?.badge} 插件</span>
                    </button>

                    {showPluginDropdown && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowPluginDropdown(false)}></div>
                        <div className="absolute left-0 bottom-full mb-2 w-64 rounded-2xl border border-white/15 bg-zinc-900/95 p-2 shadow-2xl backdrop-blur-2xl z-50">
                          <p className="px-3 py-1 text-[10px] font-black uppercase text-zinc-500">Claude Code 插件预设</p>
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

              {/* Send Button */}
              <button
                onClick={() => handleSend()}
                disabled={(!input.trim() && uploadedImages.length === 0) || isLoading}
                className="w-9 h-9 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <p className="text-[10px] text-center text-zinc-500">
            XcAI Spark Agent 可用于生成商业视觉方案、代码重构与多步 Task Planning 规划。
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
  );
};
