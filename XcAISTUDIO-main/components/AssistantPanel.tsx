

import React, { useRef, useEffect, useState } from 'react';
import { 
  X, Eraser, Copy, CornerDownLeft, Loader2, Sparkles, Brain, PenLine, Wand2,
  Shirt, Palette, Award, Home, MessageSquare, Clapperboard, Megaphone, ScanFace, Zap,
  Clock, Plus, AtSign, FileText, Globe, ArrowUp, ChevronDown, ChevronRight, RotateCcw
} from 'lucide-react';
import { sendChatMessage } from '../services/geminiService';

interface Message {
  role: 'user' | 'model';
  text: string;
}

interface AssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// --- 选择技能的配置数据 ---
const SKILLS = [
  {
    id: 'clothing',
    title: '电商衣图',
    desc: '全套主图 / 详情强化 / UGC 实拍 / AI 造型师',
    prompt: '我想为我的商品图片生成电商衣图，强化主图视觉和AI造型...',
    icon: Shirt,
    color: 'text-purple-400'
  },
  {
    id: 'design',
    title: '网感设计',
    desc: '营销 / 节日 / 活动主视觉',
    prompt: '帮我设计一款极具网感的营销/节日活动主视觉，包含创意排版建议...',
    icon: Palette,
    color: 'text-cyan-400'
  },
  {
    id: 'brand',
    title: '品牌设计',
    desc: 'Logo / VI / 品牌全套识别',
    prompt: '我要设计一套品牌VI和Logo，请帮我规划完整的品牌全套识别...',
    icon: Award,
    color: 'text-amber-400'
  },
  {
    id: 'interior',
    title: '室内设计',
    desc: '户型上色 / 软装方案 / 材质拼贴',
    prompt: '如何对户型图进行上色和软装设计？请提供材质拼贴方案...',
    icon: Home,
    color: 'text-emerald-400'
  },
  {
    id: 'social',
    title: '社交媒体',
    desc: '小红书封面 / 社交轮播 / 跨平台适配 / 投放素材',
    prompt: '我想制作一张吸引人的小红书封面，适配社交平台轮播的文案与投放素材...',
    icon: MessageSquare,
    color: 'text-pink-400'
  },
  {
    id: 'drama',
    title: '剧情短片',
    desc: '故事短片 / 微剧 / 电影感 / Vlog / 创意广告',
    prompt: '我想写一部剧情短片的脚本，需要有电影感、适合做抖音/Vlog广告...',
    icon: Clapperboard,
    color: 'text-indigo-400'
  },
  {
    id: 'marketing',
    title: '营销视频',
    desc: '创意短片 / TVC / 品牌故事 / 亚马逊带货',
    prompt: '帮我构思一个亚马逊带货的营销短视频TVC脚本，突出产品痛点...',
    icon: Megaphone,
    color: 'text-orange-400'
  },
  {
    id: 'recognition',
    title: '智能识别',
    desc: '剧情分析 / 角色一致短片',
    prompt: '请帮我进行剧情分析，并设计如何保持短片中角色特征的一致性...',
    icon: ScanFace,
    color: 'text-blue-400'
  },
  {
    id: 'lightning',
    title: '爆款实验室',
    desc: '上传视频一键爆款复刻',
    prompt: '我想进行爆款视频复刻，上传原视频一键还原生成相似的爆款...',
    icon: Zap,
    color: 'text-red-400'
  }
];

// --- 富文本渲染逻辑 ---
const parseInlineStyles = (text: string): React.ReactNode[] => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
          const content = part.slice(2, -2);
          return <span key={i} className="text-white font-bold mx-0.5">{content}</span>;
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
            <h1 key={key} className="text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 mt-5 mb-3 border-b border-white/10 pb-2">
                {line.replace(/^#\s/, '')}
            </h1>
        );
        return;
    }
    
    if (line.startsWith('## ')) {
         elements.push(
            <h2 key={key} className="text-sm font-bold text-white mt-4 mb-2 flex items-center gap-2">
                <span className="w-1 h-4 bg-cyan-500 rounded-full inline-block" />
                {line.replace(/^##\s/, '')}
            </h2>
        );
        return;
    }

    if (line.startsWith('### ') || line.startsWith('#### ')) {
        const content = line.replace(/^#+\s/, '');
         elements.push(
            <h3 key={key} className="text-xs font-bold text-cyan-300 mt-3 mb-1 uppercase tracking-wider">
                {content}
            </h3>
        );
        return;
    }

    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        const content = trimmed.replace(/^[\*\-]\s/, '');
        elements.push(
            <div key={key} className="flex gap-2 ml-1 mb-1.5 items-start group/list">
                <span className="w-1.5 h-1.5 rounded-full bg-white/20 mt-[7px] shrink-0 group-hover/list:bg-cyan-400 transition-colors" />
                <div className="text-[13px] leading-relaxed text-slate-300 flex-1">
                    {parseInlineStyles(content)}
                </div>
            </div>
        );
        return;
    }

    if (/^\d+\.\s/.test(trimmed)) {
        const [num, ...rest] = trimmed.split(/\.\s/);
        const content = rest.join('. ');
        elements.push(
            <div key={key} className="flex gap-2 ml-1 mb-1.5 items-start">
                <span className="text-xs font-mono text-cyan-500/80 mt-[2px] shrink-0">{num}.</span>
                <div className="text-[13px] leading-relaxed text-slate-300 flex-1">
                    {parseInlineStyles(content)}
                </div>
            </div>
        );
        return;
    }

    if (trimmed.startsWith('> ')) {
        const content = trimmed.replace(/^>\s/, '');
        elements.push(
            <div key={key} className="pl-3 border-l-2 border-cyan-500/30 italic text-slate-400 my-2 text-xs">
                {parseInlineStyles(content)}
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

export const AssistantPanel: React.FC<AssistantPanelProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([{ role: 'model', text: '你好！我是您的创意助手。今天想创作些什么？' }]);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');
  
  // 各种功能模式的状态
  const [isThinkingMode, setIsThinkingMode] = useState(false);
  const [isStoryboardActive, setIsStoryboardActive] = useState(false);
  const [isHelpMeWriteActive, setIsHelpMeWriteActive] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // 动态生成高度真实的随机 session ID
  const [sessionId] = useState(() => {
    const chars = '0123456789';
    let res = 'sess-';
    for (let i = 0; i < 3; i++) res += chars[Math.floor(Math.random() * chars.length)];
    res += '...';
    for (let i = 0; i < 6; i++) res += chars[Math.floor(Math.random() * chars.length)];
    return res;
  });

  // 自动滚动到底部
  useEffect(() => {
    if (isOpen) {
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [messages, isLoading, isOpen]);

  // 点击外部收起面板
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && panelRef.current && !panelRef.current.contains(event.target as Node)) {
        // 避开右下角悬浮的小球触发区，防止双击冲突
        const assistantBtn = document.querySelector('.floating-assistant-btn');
        if (assistantBtn && assistantBtn.contains(event.target as Node)) {
          return;
        }
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // 发送消息
  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    const userText = input;
    setInput(''); 
    
    const newMessages: Message[] = [...messages, { role: 'user', text: userText }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
        const history = messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
        
        const responseText = await sendChatMessage(history, userText, { 
            isThinkingMode, 
            isStoryboard: isStoryboardActive,
            isHelpMeWrite: isHelpMeWriteActive 
        });
        
        setMessages(prev => [...prev, { role: 'model', text: responseText }]);
    } catch (error: any) {
        setMessages(prev => [...prev, { role: 'model', text: error.message || "连接错误，请稍后重试。" }]);
    } finally {
        setIsLoading(false);
    }
  };

  // 清空对话
  const handleClearChat = () => {
    setMessages([{ role: 'model', text: '你好！我是您的创意助手。今天想创作些什么？' }]);
  };

  // 复制气泡内容
  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text).then(() => {
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    }).catch(err => console.error("Copy failed", err));
  };

  // 点击技能模板自动填入输入框并聚焦
  const handleSkillClick = (promptText: string) => {
    setInput(promptText);
    textareaRef.current?.focus();
  };

  const SPRING_ANIMATION = "transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]";

  return (
    <div 
      ref={panelRef}
      className={`fixed right-0 top-0 bottom-0 h-screen w-[460px] bg-[#0d0d0f]/98 border-l border-white/10 shadow-2xl z-40 flex flex-col overflow-hidden ${SPRING_ANIMATION} ${isOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'}`}
      onMouseDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* 头部面板区域 */}
      <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#0d0d0f] z-10 shrink-0 select-none">
        <div className="flex items-center gap-3">
          {/* 精致的呼吸绿色头像 */}
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-500 via-emerald-400 to-green-300 flex items-center justify-center text-black shadow-[0_0_12px_rgba(16,185,129,0.25)] relative overflow-hidden shrink-0">
            {/* 头像内部萌萌眼与嘴巴 */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-black">
              <circle cx="8" cy="11" r="2" fill="black" />
              <circle cx="16" cy="11" r="2" fill="black" />
              <path d="M10 14.5C10.5 15 11.2 15.3 12 15.3C12.8 15.3 13.5 15 14 14.5" stroke="black" strokeWidth="2" strokeLinecap="round" />
              <circle cx="5.5" cy="13" r="1.2" fill="#f87171" opacity="0.8" />
              <circle cx="18.5" cy="13" r="1.2" fill="#f87171" opacity="0.8" />
            </svg>
          </div>
          
          <div className="flex flex-col">
            <span className="text-sm font-bold text-zinc-100 tracking-wide">RH 智能体</span>
            <span className="text-[9px] text-zinc-500 font-semibold tracking-wider font-mono">{sessionId}</span>
          </div>
        </div>

        {/* 头部快捷按钮 */}
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => {}} 
            className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors"
            title="历史记录"
          >
            <Clock size={16} />
          </button>
          <button 
            onClick={handleClearChat} 
            className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors"
            title="清空对话"
          >
            <RotateCcw size={16} />
          </button>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors ml-1 border-l border-white/5 pl-2.5"
            title="关闭面板"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* 聊天内容区域 */}
      <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-[#0d0d0f]">
        {messages.length === 1 && messages[0].text === '你好！我是您的创意助手。今天想创作些什么？' ? (
          /* 初始大屏欢迎页与技能选择列表 */
          <div className="flex flex-col items-start pt-6 pb-20 px-3 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* 超大呼吸感绿色头像 */}
            <div className="w-14 h-14 bg-gradient-to-tr from-emerald-500 via-emerald-400 to-green-300 flex items-center justify-center text-black rounded-full shadow-[0_0_24px_rgba(16,185,129,0.3)] mb-5 group relative overflow-hidden">
              <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping opacity-75 pointer-events-none duration-1000" />
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-black">
                <circle cx="8" cy="11" r="2" fill="black" />
                <circle cx="16" cy="11" r="2" fill="black" />
                <path d="M10 14.5C10.5 15 11.2 15.3 12 15.3C12.8 15.3 13.5 15 14 14.5" stroke="black" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="5.5" cy="13" r="1" fill="#f87171" opacity="0.7" />
                <circle cx="18.5" cy="13" r="1" fill="#f87171" opacity="0.7" />
              </svg>
            </div>
            
            {/* 欢迎语 */}
            <span className="text-xs font-semibold text-zinc-500 tracking-wider">Hi user_zt6plewl!</span>
            <h2 className="text-2xl font-bold text-white mt-1.5 mb-8 tracking-tight">今天一起创作点什么？</h2>
            
            {/* 技能标题 */}
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3.5">选择技能</span>
            
            {/* 技能列表格 */}
            <div className="w-full space-y-2">
              {SKILLS.map((skill) => {
                const IconComponent = skill.icon;
                return (
                  <div 
                    key={skill.id}
                    onClick={() => handleSkillClick(skill.prompt)}
                    className="flex items-center w-full px-3 py-2.5 rounded-xl bg-zinc-900/20 border border-white/[0.02] hover:bg-white/5 hover:border-white/5 transition-all duration-200 cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-zinc-800/40 border border-white/5 flex items-center justify-center mr-3.5 shrink-0 group-hover:bg-zinc-800 transition-colors">
                      <IconComponent size={15} className={`${skill.color} group-hover:scale-110 transition-transform`} />
                    </div>
                    <div className="flex items-baseline flex-1 min-w-0">
                      <span className="text-sm font-bold text-zinc-200 group-hover:text-white transition-colors">{skill.title}</span>
                      <span className="text-[11px] text-zinc-500 font-medium ml-3.5 truncate">{skill.desc}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* 正式对话历史记录 */
          <div className="space-y-6 pb-24">
            {messages.map((m, i) => (
              <div key={i} className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex flex-col max-w-[92%] gap-1.5 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                    
                    {/* 发言人标记 */}
                    <div className="flex items-center gap-2 px-1">
                        {m.role === 'model' && <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">RH 智能体</span>}
                        {m.role === 'user' && <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">You</span>}
                    </div>

                    {/* 消息对话气泡 */}
                    <div className="group relative transition-all w-full">
                        <div 
                            className={`
                                relative px-5 py-4 rounded-2xl shadow-sm border select-text cursor-text
                                ${m.role === 'user' 
                                    ? 'bg-[#2c2c2e] border-white/10 text-slate-100 rounded-tr-sm' 
                                    : 'bg-[#1c1c1e] border-white/5 text-slate-300 rounded-tl-sm w-full pr-10'
                                }
                            `}
                        >
                            {m.role === 'model' ? renderFormattedMessage(m.text) : <p className="leading-6 text-[13px] whitespace-pre-wrap">{m.text}</p>}
                            
                            {/* 复制气泡文本的按钮 */}
                            <button 
                                onClick={() => handleCopy(m.text, i)}
                                className={`absolute top-2 right-2 p-1.5 rounded-full bg-black/20 hover:bg-black/50 border border-white/5 text-slate-400 opacity-0 group-hover:opacity-100 transition-all hover:text-white hover:scale-110 z-10`}
                                title="复制内容"
                            >
                                {copiedIndex === i ? <span className="text-[10px] font-bold text-green-400">OK</span> : <Copy size={10} />}
                            </button>
                        </div>
                    </div>
                </div>
              </div>
            ))}

            {isLoading && (
                <div className="flex justify-start w-full animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex flex-col gap-2 max-w-[85%]">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-1 ${isThinkingMode ? 'text-indigo-400' : 'text-emerald-400'}`}>
                            {isThinkingMode ? 'Deep Thinking' : 'Thinking'}
                        </span>
                        <div className={`px-5 py-4 bg-[#1c1c1e] border rounded-2xl rounded-tl-sm flex items-center gap-3 w-fit shadow-lg ${isThinkingMode ? 'border-indigo-500/30 shadow-indigo-900/20' : 'border-white/5 shadow-emerald-900/10'}`}>
                            <Loader2 size={16} className={`animate-spin ${isThinkingMode ? 'text-indigo-400' : 'text-emerald-400'}`} />
                            <span className={`text-xs font-medium tracking-wide ${isThinkingMode ? 'text-indigo-200' : 'text-slate-400'}`}>
                                {isThinkingMode ? "深度思考中..." : isStoryboardActive ? "正在规划分镜..." : isHelpMeWriteActive ? "正在润色文本..." : "正在思考创意..."}
                            </span>
                        </div>
                    </div>
                </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* 底部输入框与控制区 */}
      <div className="p-4 bg-[#0d0d0f] border-t border-white/[0.03] shrink-0 flex flex-col gap-2 relative z-10 select-none">
        
        {/* 输入框上方的特色辅助药丸按钮 */}
        <div className="flex items-center gap-2 mb-1.5">
          <button 
            onClick={() => { setIsThinkingMode(!isThinkingMode); setIsStoryboardActive(false); setIsHelpMeWriteActive(false); }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold transition-all border ${isThinkingMode ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-[0_0_8px_rgba(99,102,241,0.15)]' : 'bg-zinc-900/40 text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-800'}`}
          >
            <Brain size={10} className={isThinkingMode ? "animate-pulse text-indigo-400" : ""} />
            <span>深度思考</span>
          </button>

          <button 
            onClick={() => { setIsStoryboardActive(!isStoryboardActive); setIsThinkingMode(false); setIsHelpMeWriteActive(false); }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold transition-all border ${isStoryboardActive ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.15)]' : 'bg-zinc-900/40 text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-800'}`}
          >
            <PenLine size={10} className={isStoryboardActive ? "text-emerald-400" : ""} />
            <span>分镜脚本</span>
          </button>

          <button 
            onClick={() => { setIsHelpMeWriteActive(!isHelpMeWriteActive); setIsThinkingMode(false); setIsStoryboardActive(false); }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold transition-all border ${isHelpMeWriteActive ? 'bg-pink-500/20 text-pink-300 border-pink-500/40 shadow-[0_0_8px_rgba(236,72,153,0.15)]' : 'bg-zinc-900/40 text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-800'}`}
          >
            <Wand2 size={10} className={isHelpMeWriteActive ? "text-pink-400" : ""} />
            <span>帮我写</span>
          </button>
        </div>

        {/* 高级卡片样式输入包围盒 */}
        <div className="bg-[#18181c] border border-white/[0.04] rounded-[20px] shadow-2xl p-2.5 flex flex-col gap-2.5 transition-all duration-300 focus-within:border-emerald-500/20 focus-within:shadow-[0_0_20px_rgba(16,185,129,0.03)] group/input">
          
          {/* 主体行：上传与文本框 */}
          <div className="flex gap-2.5 items-start">
            {/* 左侧大加号上传按钮 */}
            <div className="w-[44px] h-[44px] rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer shrink-0 group/upload" title="上传参考图">
              <Plus size={18} className="group-hover/upload:scale-110 transition-transform" />
            </div>

            {/* 文本输入框 */}
            <textarea 
              ref={textareaRef}
              className="flex-1 bg-transparent border-0 resize-none py-2 px-1 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-0 leading-5 custom-scrollbar min-h-[44px] max-h-[120px]" 
              placeholder={
                  isStoryboardActive ? "输入视频描述，我将为您生成专业分镜脚本..." :
                  isThinkingMode ? "输入复杂问题，进行深度逻辑推理..." : 
                  isHelpMeWriteActive ? "输入简短想法，我将帮您扩写和润色..." :
                  "先上传参考图，再用 @ 引用，输入你的想法..."
              }
              value={input} 
              onChange={e => setInput(e.target.value)} 
              onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                  }
              }}
              rows={1}
            />
          </div>

          {/* 底部丰富的工具栏操作栏 */}
          <div className="flex items-center justify-between border-t border-white/[0.02] pt-2.5 px-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Agent 面标按钮 */}
              <button 
                onClick={() => { setIsThinkingMode(!isThinkingMode); setIsStoryboardActive(false); setIsHelpMeWriteActive(false); }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded border transition-all ${isThinkingMode ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300' : 'border-white/5 bg-white/5 text-zinc-400 hover:text-zinc-200'}`}
              >
                <Sparkles size={11} className={isThinkingMode ? "text-indigo-400" : "text-zinc-500"} />
                <span className="text-[10px] font-bold">Agent</span>
              </button>

              {/* @ 按钮 */}
              <button className="p-1 hover:bg-white/5 rounded text-zinc-500 hover:text-zinc-300 cursor-pointer" title="提及引用">
                <AtSign size={13} />
              </button>

              {/* 文档引用按钮 */}
              <button className="p-1 hover:bg-white/5 rounded text-zinc-500 hover:text-zinc-300 cursor-pointer" title="引用文档">
                <FileText size={13} />
              </button>

              {/* 语言切换标签 */}
              <button 
                onClick={() => {}}
                className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 cursor-pointer transition-colors font-semibold"
              >
                中文 / EN
              </button>

              {/* Ask 下拉 */}
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 text-[10px] border border-white/5 hover:text-zinc-200 cursor-pointer">
                <span>Ask</span>
                <ChevronDown size={8} />
              </div>

              {/* 联网搜索与 AUTO 角标 */}
              <div className="relative p-1 hover:bg-white/5 rounded text-zinc-500 hover:text-zinc-300 cursor-pointer group/globe" title="联网搜索">
                <Globe size={13} />
                <span className="absolute -top-1.5 -right-2 px-1 py-0.2 text-[6px] font-bold bg-emerald-500 text-black rounded-full scale-75 uppercase tracking-wide">AUTO</span>
              </div>

              {/* 爆款实验室按钮 */}
              <button 
                onClick={() => { setIsStoryboardActive(!isStoryboardActive); setIsThinkingMode(false); setIsHelpMeWriteActive(false); }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded border transition-all ${isStoryboardActive ? 'border-[#eb5e28]/40 bg-[#eb5e28]/10 text-[#eb5e28]' : 'border-white/5 bg-white/5 text-zinc-400 hover:text-zinc-200'}`}
              >
                <Zap size={11} className={isStoryboardActive ? "text-[#eb5e28]" : "text-zinc-500"} />
                <span className="text-[10px] font-bold">爆款实验室</span>
              </button>
            </div>

            {/* 圆形发送按钮 */}
            <button 
              onClick={handleSendMessage} 
              disabled={!input.trim() || isLoading}
              className={`w-7 h-7 rounded-full transition-all duration-300 flex items-center justify-center cursor-pointer ${input.trim() && !isLoading ? 'bg-zinc-200 text-black hover:bg-white hover:scale-105 shadow-md' : 'bg-white/5 text-zinc-600 cursor-not-allowed'}`}
            >
              {isLoading ? <Loader2 size={12} className="animate-spin" /> : <ArrowUp size={14} strokeWidth={2.5} />}
            </button>
          </div>
        </div>

        {/* 提示脚注 */}
        <div className="text-[9px] text-zinc-600 text-center font-medium tracking-wide">
            Shift + Enter 换行
        </div>
      </div>
    </div>
  );
};