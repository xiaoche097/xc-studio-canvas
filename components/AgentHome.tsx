import React, { useState } from 'react';
import { 
  ImageIcon, 
  SettingsIcon, 
  SendIcon,
  ModelVisual,
  MarketingVisual,
  VideoVisual,
  StyleVisual,
  TranslateVisual
} from './Icons';
import { ModelTryOnModal } from './ModelTryOnModal';
import { MarketingModal } from './MarketingModal';
import { BackgroundModal } from './BackgroundModal';
import { StyleModal } from './StyleModal';
import { TranslateModal } from './TranslateModal';

import { WorkflowStep } from '../types';

interface AgentHomeProps {
  onStart: (text: string, image: string | string[] | null, model: string, step?: number) => void;
}

export const AgentHome: React.FC<AgentHomeProps> = ({ onStart }) => {
  const [input, setInput] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3-pro-preview'); // Default to Pro
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showTryOnModal, setShowTryOnModal] = useState(false);
  const [showMarketingModal, setShowMarketingModal] = useState(false);
  // Video Modal removed for direct access
  const [showBackgroundModal, setShowBackgroundModal] = useState(false);
  const [showStyleModal, setShowStyleModal] = useState(false);
  const [showTranslateModal, setShowTranslateModal] = useState(false);

  // ... (handleImageUpload and removeImage are unchanged)

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleStart();
    }
  };

  const handleCardClick = (prompt: string, title?: string) => {
    if (title === "模特上身") {
        setShowTryOnModal(true);
    } else if (title === "营销图生成") {
        setShowMarketingModal(true);
    } else if (title === "视频工作站") {
        // Direct jump to Video Station, bypassing modal
        onStart("/video", [], selectedModel, WorkflowStep.VIDEO_GENERATION);
    } else if (title === "风格模仿") {
        setShowStyleModal(true);
    } else if (title === "图片翻译") {
        setShowTranslateModal(true);
    } else {
        setInput(prompt);
    }
  };

  const handleModalConfirm = (modelImg: string, garmentImg: string, aspectRatio: string, resolution: string) => {
      setShowTryOnModal(false);
      onStart(
        `/model 模特上身生成 (比例: ${aspectRatio}, 清晰度: ${resolution})`, 
        [modelImg, garmentImg], 
        selectedModel,
        WorkflowStep.MODEL_TRY_ON
      );
  };

  const handleMarketingConfirm = (productImg: string) => {
      setShowMarketingModal(false);
      onStart("/marketing 生成亚马逊黑五风格的营销海报，突出促销氛围", [productImg], selectedModel);
  };

  const handleBackgroundConfirm = (productImg: string, bgImg: string) => {
      setShowBackgroundModal(false);
      onStart("/background 将左侧商品自然融合到右侧场景中，保持光影自然，生成高品质背景图", [productImg, bgImg], selectedModel);
  };

  const handleStyleConfirm = (productImg: string, styleImg: string) => {
      setShowStyleModal(false);
      onStart("/style 参考右侧图片的视觉风格（配色、光影、构图），重新生成左侧商品的展示图", [productImg, styleImg], selectedModel);
  };

  const handleTranslateConfirm = (img: string) => {
      setShowTranslateModal(false);
      onStart("/translate 将图片中的文案翻译为英语，保持原文排版和风格", [img], selectedModel);
  };

  const FEATURE_CARDS = [
    {
      title: "模特上身",
      prompt: "/model 模特上身生成，请上传服装平铺图",
      bgClass: "from-white to-orange-50/50 dark:from-white/5 dark:to-orange-900/20",
      borderClass: "hover:border-orange-200 dark:hover:border-orange-500/30",
      textClass: "text-gray-800 dark:text-gray-100",
      visualColor: "text-brand-orange",
      Visual: ModelVisual
    },
    {
      title: "营销图生成",
      prompt: "/marketing 生成节日促销海报",
      bgClass: "from-white to-red-50/50 dark:from-white/5 dark:to-red-900/20",
      borderClass: "hover:border-red-200 dark:hover:border-red-500/30",
      textClass: "text-gray-800 dark:text-gray-100",
      visualColor: "text-red-500",
      Visual: MarketingVisual
    },
    {
      title: "视频工作站",
      prompt: "/video 生成一段产品展示视频",
      bgClass: "from-white to-violet-50/50 dark:from-white/5 dark:to-violet-900/20",
      borderClass: "hover:border-violet-200 dark:hover:border-violet-500/30",
      textClass: "text-gray-800 dark:text-gray-100",
      visualColor: "text-violet-500",
      Visual: VideoVisual
    },
    {
      title: "风格模仿",
      prompt: "/style 学习并模仿上传图片的视觉风格",
      bgClass: "from-white to-sky-50/50 dark:from-white/5 dark:to-sky-900/20",
      borderClass: "hover:border-sky-200 dark:hover:border-sky-500/30",
      textClass: "text-gray-800 dark:text-gray-100",
      visualColor: "text-sky-500",
      Visual: StyleVisual
    },
    {
      title: "图片翻译",
      prompt: "/translate 将图片中的文案翻译为英语",
      bgClass: "from-white to-amber-50/50 dark:from-white/5 dark:to-amber-900/20",
      borderClass: "hover:border-amber-200 dark:hover:border-amber-500/30",
      textClass: "text-gray-800 dark:text-gray-100",
      visualColor: "text-amber-500",
      Visual: TranslateVisual
    }
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-[#F8FAFC] dark:bg-[#050505] transition-colors duration-500 font-sans">
      <div className="absolute top-0 left-0 w-full h-full opacity-40 dark:opacity-20 pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
      <div className="absolute -top-[20%] right-[10%] w-[800px] h-[800px] bg-brand-orange/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-6xl z-10 flex flex-col items-center gap-10">
        <div className="text-center animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-gray-900 dark:text-white mb-2">
            SKYSPER <span className="text-brand-orange">AGENT</span>
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
                <div className="relative">
                  <button 
                    onClick={() => setShowModelMenu(!showModelMenu)}
                    className="px-4 py-2 rounded-full bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 text-sm font-medium text-gray-600 dark:text-gray-300 flex items-center gap-2 transition-all border border-gray-100 dark:border-white/5"
                  >
                    <SettingsIcon />
                    {selectedModel === 'gemini-3-pro-preview' ? 'Gemini 3 Pro' : 'Gemini 3 Flash'}
                  </button>
                  
                  {showModelMenu && (
                    <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-xl border border-gray-200 dark:border-white/10 overflow-hidden z-20 animate-in fade-in slide-in-from-top-2">
                      <button 
                        onClick={() => { setSelectedModel('gemini-3-pro-preview'); setShowModelMenu(false); }}
                        className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-white/5 flex items-center justify-between ${selectedModel === 'gemini-3-pro-preview' ? 'text-brand-orange bg-brand-orange/5' : 'text-gray-700 dark:text-gray-300'}`}
                      >
                        Gemini 3 Pro
                        {selectedModel === 'gemini-3-pro-preview' && <span className="text-xs">✓</span>}
                      </button>
                      <div className="h-px bg-gray-100 dark:bg-white/5"></div>
                      <button 
                        onClick={() => { setSelectedModel('gemini-3-flash-preview'); setShowModelMenu(false); }}
                        className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-white/5 flex items-center justify-between ${selectedModel === 'gemini-3-flash-preview' ? 'text-brand-orange bg-brand-orange/5' : 'text-gray-700 dark:text-gray-300'}`}
                      >
                        Gemini 3 Flash
                        {selectedModel === 'gemini-3-flash-preview' && <span className="text-xs">✓</span>}
                      </button>
                    </div>
                  )}
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

        {/* ... Feature Cards Grid ... */}
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

        <StyleModal 
            isOpen={showStyleModal} 
            onClose={() => setShowStyleModal(false)} 
            onConfirm={handleStyleConfirm} 
        />

        <TranslateModal 
            isOpen={showTranslateModal} 
            onClose={() => setShowTranslateModal(false)} 
            onConfirm={handleTranslateConfirm} 
        />
      </div>
    </div>
  );
};