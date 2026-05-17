import React, { useState, useEffect } from 'react';
import {
  ImageIcon,
  SettingsIcon,
  SendIcon,
  ModelVisual,
  MarketingVisual,
  VideoVisual,
  AmazonSelectionVisual,
  CreativeVisual
} from './Icons';
import { ModelTryOnModal } from './ModelTryOnModal';
import { MarketingModal } from './MarketingModal';
import { BackgroundModal } from './BackgroundModal';
import { TranslateModal } from './TranslateModal';
import { RecentProjects } from './RecentProjects';
import { ProjectDetailModal } from './ProjectDetailModal';
import { storageService, Project } from '../services/storageService';
import { UnifiedSettingsModal } from './UnifiedSettingsModal';
import { Bot, Sparkles } from 'lucide-react';

import { WorkflowStep } from '../types';
import { compressImageFiles } from '../Cyzx4/utils/imageCompressor';

interface AgentHomeProps {
  onStart: (text: string, image: string | string[] | null, model: string, step?: number) => void;
}

export const AgentHome: React.FC<AgentHomeProps> = ({ onStart }) => {
  const [input, setInput] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.1-flash-lite-preview'); // Default to 3.1 Flash
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  
  const HOME_MODELS = [
    { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash', badge: '推荐' },
    { id: 'gpt-5.5', name: 'GPT-5.5 Global', badge: 'New' },
    { id: 'claude-opus-4-7', name: 'Claude 4.7 Opus', badge: 'Pro' },
  ];
  
  const [agentName, setAgentName] = useState('XcAI 首席电商视觉策划师');

  useEffect(() => {
    // Read agent name from localStorage
    const savedName = localStorage.getItem('agentName');
    if (savedName) setAgentName(savedName);

    // Listen to settings update
    const handleSettingsUpdate = () => {
      const newName = localStorage.getItem('agentName');
      if (newName) setAgentName(newName);
    };
    window.addEventListener('agent-settings-updated', handleSettingsUpdate);
    return () => window.removeEventListener('agent-settings-updated', handleSettingsUpdate);
  }, []);


  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showUnifiedSettings, setShowUnifiedSettings] = useState(false);
  const [initialSettingsTab, setInitialSettingsTab] = useState<'model' | 'agent'>('model');
  const [showTryOnModal, setShowTryOnModal] = useState(false);
  const [showMarketingModal, setShowMarketingModal] = useState(false);
  // Video Modal removed for direct access
  const [showBackgroundModal, setShowBackgroundModal] = useState(false);
  const [showTranslateModal, setShowTranslateModal] = useState(false);
  const [selectedRecentProject, setSelectedRecentProject] = useState<Project | null>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = await compressImageFiles(Array.from(e.target.files));
      if (images.length + files.length > 5) {
        alert("最多支持 5 张图片");
        return;
      }

      files.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setImages(prev => [...prev, reader.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
      // Reset input
      e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleStart = () => {
    if (input.trim() || images.length > 0) {
      onStart(input, images, selectedModel);
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleStart();
    }
  };

  const handleCardClick = async (prompt: string, title?: string) => {
    if (title === "模特工厂") {
      onStart("/model-factory", [], selectedModel, WorkflowStep.MODEL_FACTORY);
    } else if (title === "AI创意视频") {
      // 跳转到 Cyzx4 工作台的分镜创作 Tab
      onStart("/storyboard", [], selectedModel, WorkflowStep.STORYBOARD_CREATION);
    } else if (title === "小彻工作站") {
      // 直接跳转到小彻工作站（视频生成），绕过弹窗
      onStart("/video", [], selectedModel, WorkflowStep.VIDEO_GENERATION);
    } else if (title === "玩偶工厂") {
      // Direct jump to Doll Factory, bypassing modal
      onStart("/doll", [], selectedModel, WorkflowStep.DOLL_FACTORY);
    } else if (title === "创意中心") {
      // Direct jump to Creative Center
      onStart("/creative", [], selectedModel);
    } else {
      setInput(prompt);
    }
  };

  const handleModalConfirm = async (modelImg: string, garmentImg: string, aspectRatio: string, resolution: string) => {
    setShowTryOnModal(false);
    onStart(
      `/model 模特上身生成 (比例: ${aspectRatio}, 清晰度: ${resolution})`,
      [modelImg, garmentImg],
      selectedModel,
      WorkflowStep.MODEL_TRY_ON
    );
  };

  const handleMarketingConfirm = async (productImages: string[], aspectRatio: string, description: string, resolution: string) => {
    setShowMarketingModal(false);
    const promptDescription = description.trim() ? ` 详细要求: ${description}` : '';
    onStart(
      `/marketing 生成节日促销海报 (比例: ${aspectRatio}, 分辨率: ${resolution})${promptDescription}`,
      productImages,
      selectedModel,
      WorkflowStep.MARKETING_IMAGE_GENERATION
    );
  };

  const handleBackgroundConfirm = (productImg: string, bgImg: string) => {
    setShowBackgroundModal(false);
    onStart("/background 将左侧商品自然融合到右侧场景中，保持光影自然，生成高品质背景图", [productImg, bgImg], selectedModel);
  };

  const handleTranslateConfirm = (img: string) => {
    setShowTranslateModal(false);
    onStart("/creative 创意生成，发挥你的想象力，基于这张图片生成新的设计概念", [img], selectedModel);
  };

  const FEATURE_CARDS = [
    {
      title: "模特工厂",
      prompt: "/model-factory 模特工厂生成，开始姿势裂变",
      bgClass: "from-white to-orange-50/50 dark:from-white/5 dark:to-orange-900/20",
      borderClass: "hover:border-orange-200 dark:hover:border-orange-500/30",
      textClass: "text-gray-800 dark:text-gray-100",
      visualColor: "text-brand-orange",
      Visual: ModelVisual
    },
    {
      title: "AI创意视频",
      prompt: "/storyboard 分镜创作",
      bgClass: "from-white to-red-50/50 dark:from-white/5 dark:to-red-900/20",
      borderClass: "hover:border-red-200 dark:hover:border-red-500/30",
      textClass: "text-gray-800 dark:text-gray-100",
      visualColor: "text-red-500",
      Visual: MarketingVisual
    },
    {
      title: "小彻工作站",
      prompt: "/video 生成一段产品展示视频",
      bgClass: "from-white to-pink-50/50 dark:from-white/5 dark:to-pink-900/20",
      borderClass: "hover:border-pink-200 dark:hover:border-pink-500/30",
      textClass: "text-gray-800 dark:text-gray-100",
      visualColor: "text-pink-500",
      Visual: VideoVisual
    },
    {
      title: "玩偶工厂",
      prompt: "/doll-factory 开启玩偶主图调整",
      bgClass: "from-white to-sky-50/50 dark:from-white/5 dark:to-sky-900/20",
      borderClass: "hover:border-sky-200 dark:hover:border-sky-500/30",
      textClass: "text-gray-800 dark:text-gray-100",
      visualColor: "text-sky-500",
      Visual: AmazonSelectionVisual
    },
    {
      title: "创意中心",
      prompt: "/creative 创意灵感生成",
      bgClass: "from-white to-amber-50/50 dark:from-white/5 dark:to-amber-900/20",
      borderClass: "hover:border-amber-200 dark:hover:border-amber-500/30",
      textClass: "text-gray-800 dark:text-gray-100",
      visualColor: "text-amber-500",
      Visual: CreativeVisual
    }
  ];

  return (
    <div className="h-full w-full overflow-y-auto overflow-x-hidden flex flex-col items-center p-6 py-12 relative bg-[#F8FAFC] dark:bg-[#050505] transition-colors duration-500 font-sans">
      <div className="fixed top-0 left-0 w-full h-full opacity-40 dark:opacity-20 pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
      <div className="fixed -top-[20%] right-[10%] w-[800px] h-[800px] bg-brand-orange/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-6xl z-10 flex flex-col items-center gap-10">
        <div className="text-center animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-gray-900 dark:text-white mb-2">
            XcAI <span className="text-brand-orange">AGENT</span>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 font-light text-lg">
            Create professional e-commerce visuals in seconds.
          </p>
        </div>

        <div className="w-full max-w-4xl animate-slide-up group">
          <div className="relative rounded-[2rem] transition-all duration-300 bg-white dark:bg-[#121212] shadow-2xl shadow-gray-200/50 dark:shadow-black/50 border border-white/50 dark:border-white/10 hover:shadow-gray-300/50 dark:hover:shadow-brand-orange/5 group-focus-within:ring-1 group-focus-within:ring-brand-orange/30">
            <div className="p-1">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe your product or upload an image..."
                className="w-full bg-transparent border-none outline-none text-gray-800 dark:text-gray-100 text-lg px-8 py-6 min-h-[120px] resize-none placeholder-gray-400 dark:placeholder-gray-600 font-light rounded-[1.8rem]"
              ></textarea>
            </div>

            <div className="px-6 pb-4 pt-2 flex items-center justify-between">
              <div className="flex gap-2 items-center flex-wrap">
                <button className="relative px-4 py-2 rounded-full bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 text-sm font-medium text-gray-600 dark:text-gray-300 flex items-center gap-2 transition-all border border-gray-100 dark:border-white/5 overflow-hidden group/btn">
                  <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleImageUpload} accept="image/*" />
                  <ImageIcon />
                  <span className={images.length > 0 ? "text-brand-orange" : ""}>
                    {images.length > 0 ? `Add (${images.length}/5)` : "Upload"}
                  </span>
                </button>

                {/* Image Previews */}
                {images.map((img, idx) => (
                  <div key={idx} className="relative w-10 h-10 rounded-lg overflow-hidden border border-brand-orange/20 shadow-sm group/preview shrink-0">
                    <img src={img} alt="Upload preview" className="w-full h-full object-cover" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage(idx);
                      }}
                      className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/preview:opacity-100 transition-opacity text-white text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {/* Model Selector */}
                <div className="relative flex items-center gap-2">
                  <div className="relative">
                    <button
                      onClick={() => setShowModelDropdown(!showModelDropdown)}
                      className={`px-4 py-2 rounded-full transition-all border flex items-center gap-2 text-sm font-medium ${
                        showModelDropdown 
                        ? "bg-brand-orange/10 border-brand-orange/30 text-brand-orange shadow-inner" 
                        : "bg-gray-50 dark:bg-white/5 border-gray-100 dark:border-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10"
                      }`}
                    >
                      <SettingsIcon className={`w-4 h-4 transition-transform duration-300 ${showModelDropdown ? 'rotate-90' : ''}`} />
                      {HOME_MODELS.find(m => m.id === selectedModel)?.name || 'Gemini 3.1 Flash'}
                    </button>

                    {/* Dropdown Menu */}
                    {showModelDropdown && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowModelDropdown(false)}></div>
                        <div className="absolute bottom-full mb-3 left-0 w-64 bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-2xl border border-gray-100 dark:border-white/10 p-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200 backdrop-blur-xl bg-white/90 dark:bg-[#1A1A1A]/90">
                          <div className="px-3 py-2 mb-1">
                            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">选择智能模型</p>
                          </div>
                          {HOME_MODELS.map((model) => (
                            <button
                              key={model.id}
                              onClick={() => {
                                setSelectedModel(model.id);
                                setShowModelDropdown(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                                selectedModel === model.id 
                                ? 'bg-brand-orange/10 text-brand-orange' 
                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${selectedModel === model.id ? 'bg-brand-orange animate-pulse' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                                <span className="text-sm font-bold">{model.name}</span>
                              </div>
                              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                                model.badge === '推荐' ? 'bg-green-100 text-green-600 dark:bg-green-500/20' :
                                model.badge === 'New' ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20' :
                                'bg-purple-100 text-purple-600 dark:bg-purple-500/20'
                              }`}>
                                {model.badge}
                              </span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setInitialSettingsTab('agent');
                      setShowUnifiedSettings(true);
                    }}
                    className="p-2 rounded-full bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-brand-orange transition-all border border-gray-100 dark:border-white/5"
                    title="智能体设置"
                  >
                    <SettingsIcon />
                  </button>
                </div>
              </div>

              <button
                onClick={handleStart}
                disabled={!input && images.length === 0}
                className="w-12 h-12 rounded-full bg-brand-orange text-white flex items-center justify-center shadow-lg shadow-orange-500/20 hover:scale-105 hover:shadow-orange-500/40 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <SendIcon />
              </button>
            </div>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="w-full max-w-5xl grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 animate-slide-up [animation-delay:150ms]">
          {FEATURE_CARDS.map((card, idx) => (
            <div
              key={idx}
              onClick={() => handleCardClick(card.prompt, card.title)}
              className={`
                        group relative h-48 md:h-56 rounded-3xl p-5 cursor-pointer overflow-hidden transition-all duration-300 ease-out
                        bg-gradient-to-br ${card.bgClass}
                        border border-transparent ${card.borderClass}
                        hover:-translate-y-1 hover:shadow-xl hover:shadow-gray-200/50 dark:hover:shadow-black/50
                    `}
            >
              <div className="relative z-10 flex flex-col h-full">
                <h3 className={`font-bold text-lg leading-tight ${card.textClass}`}>
                  {card.title}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  Create now →
                </p>
              </div>

              <div className={`
                        absolute -bottom-6 -right-6 w-32 h-32 
                        transition-transform duration-500 ease-out 
                        group-hover:scale-110 group-hover:-rotate-3
                        ${card.visualColor} opacity-90 dark:opacity-80
                    `}>
                <card.Visual className="w-full h-full drop-shadow-sm" />
              </div>
            </div>
          ))}
        </div>

        {/* Recent Projects Section */}
        <div className="w-full max-w-6xl animate-slide-up [animation-delay:200ms]">
          <RecentProjects
            onSelectProject={(p) => setSelectedRecentProject(p)}
            onViewAll={() => window.dispatchEvent(new CustomEvent('open-history'))}
            onOpenSettings={(tab) => {
              setInitialSettingsTab(tab);
              setShowUnifiedSettings(true);
            }}
          />
        </div>

        <ModelTryOnModal
          isOpen={showTryOnModal}
          onClose={() => setShowTryOnModal(false)}
          onConfirm={handleModalConfirm}
        />

        <MarketingModal
          isOpen={showMarketingModal}
          onClose={() => setShowMarketingModal(false)}
          onConfirm={handleMarketingConfirm}
        />

        <BackgroundModal
          isOpen={showBackgroundModal}
          onClose={() => setShowBackgroundModal(false)}
          onConfirm={handleBackgroundConfirm}
        />

        <TranslateModal
          isOpen={showTranslateModal}
          onClose={() => setShowTranslateModal(false)}
          onConfirm={handleTranslateConfirm}
        />

        <ProjectDetailModal
          project={selectedRecentProject}
          onClose={() => setSelectedRecentProject(null)}
          onDelete={async (id) => {
            await storageService.deleteProject(id);
            setSelectedRecentProject(null);
            window.location.reload();
          }}
        />

        <UnifiedSettingsModal 
          isOpen={showUnifiedSettings}
          onClose={() => setShowUnifiedSettings(false)}
          initialTab={initialSettingsTab}
        />
      </div>
    </div>
  );
};