import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Sparkles, Send, ChevronDown, MonitorPlay, LayoutDashboard, 
  Search, MessageSquare, X, Maximize2, Plus, Zap, ChevronRight,
  Film, Grid, Image, Check, Clapperboard, Palette, Youtube, Video
} from 'lucide-react';

// --- Configuration & Data ---

const AVATAR_URL = "https://cdn.jsdelivr.net/gh/xiaoche0907/pic-bed@main/img_1768967709827_469_8d88a408-c7a9-4da6-be2a-a944cac97b06.jpg";

// Type Definitions
interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  tag?: string;
  type?: 'item' | 'submenu';
  agentId?: string;
  children?: MenuItem[];
}

interface MenuDivider {
  type: 'divider';
  id?: undefined;
  children?: undefined;
}

type MenuEntry = MenuItem | MenuDivider;

// 1. New Menu Data Structure
const MENU_STRUCTURE: MenuEntry[] = [
  {
    id: 'storyboard',
    label: '分镜策划',
    icon: <Film size={14} />,
    tag: '1min',
    type: 'item',
    agentId: 'storyboard'
  },
  {
    id: 'moodboard',
    label: '情绪板',
    icon: <Grid size={14} />,
    tag: '30s',
    type: 'item',
    agentId: 'moodboard'
  },
  {
    id: 'inspiration-group',
    label: '寻找灵感',
    icon: <Image size={14} />,
    type: 'submenu',
    children: [
      { id: 'insp-movie', label: '电影镜头灵感', icon: <Clapperboard size={14} />, tag: '30s', agentId: 'inspiration' },
      { id: 'insp-mj', label: 'Midjourney 风格', icon: <Palette size={14} />, tag: '30s', agentId: 'inspiration' },
      { id: 'insp-unsplash', label: 'Unsplash 图片', icon: <Image size={14} />, tag: '30s', agentId: 'inspiration' },
      { id: 'insp-ad', label: '广告视频灵感', icon: <Video size={14} />, tag: '30s', agentId: 'inspiration' },
      { id: 'insp-yt', label: 'YouTube 视频', icon: <Youtube size={14} />, tag: '30s', agentId: 'inspiration' }
    ]
  },
  { type: 'divider' },
  {
    id: 'conversation',
    label: '对话模式',
    icon: <MessageSquare size={14} />,
    type: 'item',
    agentId: 'storyboard' // Default fall back or specific conversational agent
  }
];

const AGENTS_CONFIG = {
  storyboard: {
    id: 'storyboard',
    name: '分镜策划',
    role: 'Storyboard Pro',
    icon: <MonitorPlay size={16} />,
    color: 'blue',
    systemPrompt: `你是一位资深的电影分镜导演...`, // (Truncated for brevity, logic remains same)
    suggestions: [
      {
        title: '日式 City Pop MV',
        prompt: '为日式 City Pop 风格的夏日遗憾主题 MV...'
      },
      {
        title: '咖啡机产品广告',
        prompt: '帮我为产品 Tapnow 咖啡机创建 30 秒 YouTube 广告分镜...'
      },
      {
        title: '玄幻小说特效分镜',
        prompt: '20 个镜头。这是修仙者与上古凶兽的决战...'
      }
    ]
  },
  moodboard: {
    id: 'moodboard',
    name: '情绪板专家',
    role: 'Mood Board Expert',
    icon: <LayoutDashboard size={16} />,
    color: 'purple',
    systemPrompt: `你是一位顶尖的艺术总监和色彩专家...`,
    suggestions: [
      {
        title: '高端护肤品',
        prompt: '为高端护肤品牌制作情绪板...'
      },
      {
        title: '科技路演 PPT',
        prompt: '为科技创业公司路演 PPT 收集视觉素材...'
      },
      {
        title: '秋季时尚大片',
        prompt: '为秋季时尚大片收集参考图片...'
      }
    ]
  },
  inspiration: {
    id: 'inspiration',
    name: '寻找灵感',
    role: 'Inspiration Seeker',
    icon: <Search size={16} />,
    color: 'orange',
    systemPrompt: `你是一个跨领域的创意灵感库...`,
    suggestions: [
      {
        title: 'Midjourney 风格探索',
        prompt: '推荐 5 个目前最流行的 Midjourney 艺术风格关键词...'
      },
      {
        title: '广告视频创意',
        prompt: '我是一个卖“人体工学椅”的商家...'
      },
      {
        title: 'Unsplash 搜索词',
        prompt: '我需要找一组表达“团队协作”但不俗套的图片...'
      }
    ]
  }
};

type AgentId = keyof typeof AGENTS_CONFIG;

// --- Components ---

interface AgentBarProps {
  isDraggingNode?: boolean;
}

export const AgentBar: React.FC<AgentBarProps> = ({ isDraggingNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Logic State
  const [activeAgentId, setActiveAgentId] = useState<AgentId>('storyboard');
  const [activeModeId, setActiveModeId] = useState<string>('conversation'); // Tracks the specific menu item ID
  
  const [messages, setMessages] = useState<{role: 'user'|'assistant', content: string}[]>([]);
  const [inputValue, setInputValue] = useState('');
  
  // UI State
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [hoveredMenuId, setHoveredMenuId] = useState<string | null>(null); // For cascading
  
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState('Gemini 3 Pro');
  
  const activeAgent = AGENTS_CONFIG[activeAgentId];
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Helper to find the active item (Memoized to prevent unnecessary recalculation)
  const activeItem = useMemo(() => {
    const flatItems: MenuItem[] = [];
    MENU_STRUCTURE.forEach(item => {
      if (item.type === 'divider') return;
      if (item.children) {
        flatItems.push(...item.children);
      } else {
        flatItems.push(item);
      }
    });
    return flatItems.find(i => i.id === activeModeId);
  }, [activeModeId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (text: string) => {
    if (!text.trim()) return;
    const newMessages = [...messages, { role: 'user' as const, content: text }];
    setMessages(newMessages);
    setInputValue('');
    setTimeout(() => {
        setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: `[${activeAgent.name}] 收到需求：\n"${text}"\n\n(模拟 AI 返回内容...)` 
        }]);
    }, 800);
  };

  const handleMenuSelect = (item: any) => {
    if (item.type === 'divider' || item.type === 'submenu') return;

    setActiveModeId(item.id);
    if (item.agentId) {
        setActiveAgentId(item.agentId as AgentId);
    }
    
    // Clear history if switching main contexts (Optional UX choice)
    if (item.id !== 'conversation') {
        setMessages([]); 
    }

    setIsModeMenuOpen(false);
    setHoveredMenuId(null);
  };

  // Helper to render a single menu item
  const renderMenuItem = (item: any, isSubItem = false) => {
     if (item.type === 'divider') {
         return <div key="divider" className="h-px bg-white/10 my-1 mx-2" />;
     }

     const isActive = activeModeId === item.id;
     const hasChildren = item.type === 'submenu';
     const isHovered = hoveredMenuId === item.id;

     return (
        <div 
            key={item.id}
            className="relative group/item"
            onMouseEnter={() => setHoveredMenuId(item.id)}
            // Don't clear immediately on leave to allow moving to submenu
        >
            <button
                onClick={() => !hasChildren && handleMenuSelect(item)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors
                    ${isActive && !hasChildren ? 'bg-blue-600/10 text-blue-400' : 'text-gray-300 hover:bg-white/5 hover:text-white'}
                `}
            >
                <div className="flex items-center gap-2.5">
                    <span className={isActive ? 'text-blue-400' : 'text-gray-500 group-hover/item:text-gray-300'}>
                        {item.icon}
                    </span>
                    <span className="font-medium">{item.label}</span>
                </div>

                <div className="flex items-center gap-2">
                    {item.tag && (
                        <span className="text-[10px] text-gray-600 font-mono bg-white/5 px-1.5 py-0.5 rounded">
                            {item.tag}
                        </span>
                    )}
                    {hasChildren && <ChevronRight size={12} className="text-gray-600" />}
                    {isActive && !hasChildren && <Check size={12} className="text-blue-500" />}
                </div>
            </button>

            {/* Submenu Rendering (Cascading to LEFT) */}
            {hasChildren && isHovered && (
                <div className="absolute right-full top-0 mr-1.5 w-48 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl p-1 z-30 animate-in slide-in-from-right-2 fade-in duration-200">
                    {item.children.map((child: any) => renderMenuItem(child, true))}
                </div>
            )}
        </div>
     );
  };

  // --- FAB (Collapsed) ---
  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50 group">
        <div className="absolute right-full top-1/2 -translate-y-1/2 mr-4 px-3 py-1.5 bg-black text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/10 shadow-xl">
          与来福对话
          <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-2 bg-black transform rotate-45 border-r border-t border-white/10"></div>
        </div>

        <button 
          onClick={() => setIsOpen(true)}
          className={`relative w-[56px] h-[56px] rounded-full p-0.5 bg-white/10 border-2 border-white/20 shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 overflow-hidden group-hover:border-blue-500/50
            ${isDraggingNode ? 'animate-pulse ring-4 ring-blue-500/30' : ''}
          `}
        >
          <img src={AVATAR_URL} alt="Laifu Agent" className="w-full h-full rounded-full object-cover" />
        </button>
      </div>
    );
  }

  // --- Sidebar (Expanded) ---
  return (
    <>
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-[55] transition-opacity"
        onClick={() => setIsOpen(false)}
      />

      <div className="fixed top-0 right-0 h-full w-[400px] bg-[#1a1a1a] border-l border-white/10 shadow-[-10px_0_40px_rgba(0,0,0,0.5)] z-[60] flex flex-col transition-transform duration-300 ease-out transform translate-x-0">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#1a1a1a] relative z-20">
          <div className="flex items-center gap-3">
             <div className="relative w-10 h-10 flex-shrink-0">
                <img src={AVATAR_URL} alt="Laifu" className="w-full h-full rounded-full object-cover border border-white/10" />
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-[#1a1a1a] rounded-full"></div>
             </div>
             <div>
                 <h2 className="text-sm font-bold text-white">Laifu (来福)</h2>
                 <p className="text-[10px] text-blue-400 font-medium">AI 创意合伙人</p>
             </div>
          </div>
          <div className="flex items-center gap-1">
             <button onClick={() => setIsOpen(false)} className="p-2 text-gray-500 hover:text-white hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-colors">
                <X size={18} />
             </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide bg-[#151515]">
             {messages.length === 0 ? (
                 <div className="h-full flex flex-col justify-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                     <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mb-6 mx-auto border border-white/5 shadow-lg">
                        <Sparkles className="text-blue-400" size={24} />
                     </div>
                     <h3 className="text-center text-lg font-bold text-white mb-2">
                        嗨！我是{activeAgent.name}
                     </h3>
                     <p className="text-center text-xs text-gray-500 max-w-[80%] mx-auto mb-8 leading-relaxed">
                        {activeAgent.role === 'Storyboard Pro' && "告诉我你的故事梗概，我帮你拆解成专业的电影分镜。"}
                        {activeAgent.role === 'Mood Board Expert' && "需要确立视觉风格？让我为你寻找配色方案和质感参考。"}
                        {activeAgent.role === 'Inspiration Seeker' && "灵感枯竭？让我为你提供跨界的创意火花和搜索关键词。"}
                     </p>

                     <div className="space-y-3">
                        {activeAgent.suggestions.map((suggestion, idx) => (
                            <button 
                                key={idx}
                                onClick={() => handleSendMessage(suggestion.prompt)}
                                className="w-full text-left p-4 bg-[#1e1e1e] hover:bg-[#252525] border border-white/5 hover:border-blue-500/30 rounded-xl transition-all group relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity text-blue-500">
                                    <ChevronRight size={14} />
                                </div>
                                <h4 className="text-xs font-bold text-gray-300 group-hover:text-blue-400 mb-1 transition-colors flex items-center gap-2">
                                    <Zap size={10} className="text-yellow-500" />
                                    {suggestion.title}
                                </h4>
                                <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">
                                    {suggestion.prompt}
                                </p>
                            </button>
                        ))}
                     </div>
                 </div>
             ) : (
                 <div className="space-y-6">
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden border border-white/10
                                ${msg.role === 'user' ? 'bg-gray-700' : 'bg-blue-900/20'}
                            `}>
                                {msg.role === 'user' ? (
                                    <span className="text-xs font-bold">You</span>
                                ) : (
                                    <img src={AVATAR_URL} className="w-full h-full object-cover" />
                                )}
                            </div>
                            <div className={`max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm
                                ${msg.role === 'user' 
                                    ? 'bg-blue-600 text-white rounded-tr-none' 
                                    : 'bg-[#252525] text-gray-200 rounded-tl-none border border-white/5'}
                            `}>
                                <div className="whitespace-pre-wrap">{msg.content}</div>
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                 </div>
             )}
        </div>

        {/* Input Area (Sticky Bottom) */}
        <div className="p-5 bg-[#1a1a1a] border-t border-white/5 z-20">
            <div className="relative bg-[#222] rounded-xl border border-white/5 focus-within:border-blue-500/50 transition-colors shadow-inner flex flex-col">
                <textarea 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage(inputValue);
                        }
                    }}
                    placeholder={`向 ${activeAgent.name} 提问...`} 
                    className="w-full bg-transparent text-gray-200 placeholder-gray-600 text-sm focus:outline-none p-3 min-h-[50px] max-h-[120px] resize-none scrollbar-hide"
                    rows={1}
                />
                
                {/* Toolbar */}
                <div className="flex items-center justify-between px-2 pb-2 mt-1">
                    <div className="flex items-center gap-1">
                        <button className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors" title="添加附件">
                            <Plus size={18} />
                        </button>
                        
                        {/* Mode Switcher - Cascading Menu Trigger */}
                        <div 
                            className="relative"
                            onMouseLeave={() => {
                                // Close menu when mouse leaves the entire menu area
                                // But active state is handled by button click
                            }}
                        >
                            <button 
                                onClick={() => setIsModeMenuOpen(!isModeMenuOpen)}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-[#333] text-gray-400 hover:text-gray-200 text-[11px] transition-colors"
                            >
                                {/* Find active icon */}
                                {activeItem?.icon || <MessageSquare size={12} />}
                                
                                <span className="max-w-[80px] truncate">
                                    {activeItem?.label || '对话模式'}
                                </span>
                                <ChevronDown size={10} className={`transform transition-transform ${isModeMenuOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Cascading Menu */}
                            {isModeMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setIsModeMenuOpen(false)}></div>
                                    <div 
                                        className="absolute bottom-full mb-2 left-0 w-56 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl p-1 z-20 flex flex-col gap-0.5 animate-in slide-in-from-bottom-2 fade-in duration-200"
                                        onMouseLeave={() => setHoveredMenuId(null)} 
                                    >
                                        {MENU_STRUCTURE.map(item => renderMenuItem(item))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Model Selector */}
                        <div className="relative">
                            <button 
                                onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-[#333] text-gray-400 hover:text-gray-200 text-[10px] transition-colors border border-transparent hover:border-white/5"
                            >
                                <Sparkles size={10} />
                                <span>{selectedModel}</span>
                                <ChevronDown size={10} />
                            </button>
                            {isModelMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setIsModelMenuOpen(false)}></div>
                                    <div className="absolute bottom-full mb-2 right-0 w-32 bg-[#2a2a2a] border border-white/10 rounded-lg shadow-xl p-1 z-20 flex flex-col gap-0.5">
                                        {['Gemini 3 Pro', 'Gemini 3 Flash'].map(m => (
                                            <button 
                                                key={m}
                                                onClick={() => { setSelectedModel(m); setIsModelMenuOpen(false); }}
                                                className={`text-[10px] px-2 py-1.5 text-left rounded hover:bg-white/5 ${selectedModel === m ? 'text-blue-400' : 'text-gray-300'}`}
                                            >
                                                {m}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Send Button */}
                        <button 
                            onClick={() => handleSendMessage(inputValue)}
                            disabled={!inputValue.trim()}
                            className={`p-2 rounded-lg text-white shadow-lg transition-all flex items-center justify-center
                                ${inputValue.trim() 
                                    ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20 active:scale-95' 
                                    : 'bg-[#333] text-gray-500 cursor-not-allowed'}
                            `}
                        >
                            <Send size={14} />
                        </button>
                    </div>
                </div>
            </div>
            
            <div className="text-center mt-3">
                <span className="text-[10px] text-gray-600">内容由 AI 生成，仅供参考</span>
            </div>
        </div>
      </div>
    </>
  );
};