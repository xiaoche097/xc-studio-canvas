import React, { useState } from 'react';
import { 
  ImageIcon, 
  SettingsIcon, 
  SendIcon
} from './Icons';

interface AgentHomeProps {
  onStart: (text: string, image: string | string[] | null, model: string) => void;
}

export const AgentHome: React.FC<AgentHomeProps> = ({ onStart }) => {
  const [input, setInput] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3-pro-preview'); // Default to Pro
  const [showModelMenu, setShowModelMenu] = useState(false);

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
        
        {/* Removed Feature Cards and Modals as requested by user to keep main branch clean */}
        
      </div>
    </div>
  );
};