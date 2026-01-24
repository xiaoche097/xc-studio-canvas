import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronDown, ArrowUp, Zap, Scan, Settings2, Plus, 
  Image as ImageIcon, Wand2, Smartphone, Monitor, Square,
  Video, Film, Play
} from 'lucide-react';
import { NodeData } from '../types';

interface ImageGenNodeProps {
  node: NodeData;
  onUpdate: (id: string, newData: Partial<NodeData>) => void;
}

// Configuration Constants
const QUALITY_OPTIONS = [
  { id: '1k', label: '1K' },
  { id: '2k', label: '2K' },
  { id: '4k', label: '4K' }
];

const ASPECT_RATIOS = [
  { id: '1:1', icon: <Square size={14} />, label: '1:1' },
  { id: '9:16', icon: <Smartphone size={14} />, label: '9:16' },
  { id: '16:9', icon: <Monitor size={14} />, label: '16:9' },
  { id: '3:4', icon: <div className="w-3 h-4 border border-current rounded-[1px]" />, label: '3:4' },
  { id: '4:3', icon: <div className="w-4 h-3 border border-current rounded-[1px]" />, label: '4:3' }
];

export const ImageGenNode: React.FC<ImageGenNodeProps> = ({ node, onUpdate }) => {
  // State
  const [prompt, setPrompt] = useState(node.content || '');
  const [model, setModel] = useState(node.data?.model || 'NanoBananaPro');
  const [aspectRatio, setAspectRatio] = useState(node.data?.aspectRatio || 'adaptive');
  const [quality, setQuality] = useState(node.data?.quality || '2k');
  const [batchCount, setBatchCount] = useState(1);

  // UI State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Sync Content
  useEffect(() => {
    if (prompt !== node.content) {
      const timer = setTimeout(() => {
        onUpdate(node.id, { content: prompt });
      }, 500); 
      return () => clearTimeout(timer);
    }
  }, [prompt, node.id, onUpdate, node.content]);

  // Sync Settings
  useEffect(() => {
    onUpdate(node.id, {
      data: { ...node.data, model, aspectRatio, quality }
    });
  }, [model, aspectRatio, quality, node.id, onUpdate]);

  // Click Outside Listener for Popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        settingsRef.current && 
        !settingsRef.current.contains(event.target as Node) &&
        toolbarRef.current &&
        !toolbarRef.current.contains(event.target as Node)
      ) {
        setIsSettingsOpen(false);
      }
    };

    if (isSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSettingsOpen]);

  return (
    <div className="relative w-[300px]">
      
      {/* --- Node Body (Unselected / Base State) --- */}
      {/* Deep Dark Card Container - Dynamic Background on Select */}
      <div className={`flex flex-col p-6 rounded-3xl border border-white/10 shadow-xl transition-all duration-300 group-hover:border-white/20 hover:shadow-2xl
         ${node.selected ? 'bg-zinc-800' : 'bg-zinc-900'}
      `}>
        
        {/* A. Header */}
        <div className="flex items-center gap-2.5 mb-6">
           <div className="w-6 h-6 rounded-lg bg-zinc-800 flex items-center justify-center border border-white/5 shadow-inner">
             <ImageIcon size={14} className="text-zinc-300" />
           </div>
           <span className="text-sm font-bold text-zinc-200 tracking-wide">Image</span>
        </div>
        
        {/* B. Subtitle */}
        <div className="text-[10px] font-medium text-zinc-600 mb-2 ml-1 uppercase tracking-wider">尝试:</div>

        {/* C. Feature List */}
        <div className="flex flex-col gap-1.5">
            <FeatureItem icon={<ImageIcon size={15} />} label="图生图" />
            <FeatureItem icon={<Video size={15} />} label="图生视频" />
            <FeatureItem icon={<Wand2 size={15} />} label="图片换背景" />
            <FeatureItem icon={<Film size={15} />} label="首帧图生视频" />
        </div>
      </div>

      {/* --- STATE B: Floating Toolbar (Only when selected) --- */}
      {node.selected && (
         <div 
            ref={toolbarRef}
            className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-[380px] z-[100] animate-in slide-in-from-top-4 fade-in duration-200"
            onPointerDown={(e) => e.stopPropagation()}
         >
            {/* Glass Container - Modified for Deep Glass Effect (bg-black/60) */}
            <div className="bg-black/60 backdrop-blur-2xl rounded-[24px] border border-white/10 shadow-2xl flex flex-col overflow-visible relative">
               
               {/* 1. Input Area */}
               <div className="relative p-4 pb-12">
                   <textarea
                       value={prompt}
                       onChange={(e) => setPrompt(e.target.value)}
                       placeholder="输入画面描述..."
                       className="w-full bg-transparent text-sm text-white placeholder-white/20 resize-none focus:outline-none min-h-[50px] leading-relaxed scrollbar-hide selection:bg-purple-500/30"
                       rows={2}
                       style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                   />
                   
                   {/* Floating Style Button (Inside Input) */}
                   <div className="absolute bottom-3 left-4">
                      <button className="flex items-center gap-1.5 px-3 py-1 bg-zinc-800/80 hover:bg-zinc-700/80 rounded-full text-[10px] text-zinc-300 border border-white/5 transition-colors backdrop-blur-md group">
                          <Plus size={10} className="text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                          <span>风格</span>
                      </button>
                   </div>

                   {/* Floating Magic Wand (Inside Input) */}
                   <div className="absolute bottom-3 right-4">
                      <button className="p-1.5 text-purple-400 hover:text-purple-300 transition-colors opacity-80 hover:opacity-100 hover:bg-white/5 rounded-full">
                          <Wand2 size={14} />
                      </button>
                   </div>
               </div>

               {/* Hairline Separator */}
               <div className="h-px w-full bg-white/5"></div>

               {/* 2. Bottom Toolbar */}
               <div className="h-14 px-4 flex items-center justify-between gap-2">
                   
                   {/* Left: Model Selector */}
                   <button className="flex items-center gap-2 group hover:bg-white/5 px-2 py-1.5 rounded-lg transition-all -ml-2">
                       <Zap size={14} className="text-yellow-500 fill-yellow-500" />
                       <span className="text-xs font-medium text-zinc-300 group-hover:text-white">Banana Pro</span>
                       <ChevronDown size={12} className="text-zinc-600 group-hover:text-zinc-400" />
                   </button>

                   {/* Center: Settings Trigger */}
                   <button 
                       onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                       className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border
                           ${isSettingsOpen 
                             ? 'bg-white/10 text-white border-white/10' 
                             : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}
                       `}
                   >
                       <Settings2 size={12} />
                       <span>
                           {aspectRatio === 'adaptive' ? '自适应' : aspectRatio} · {quality.toUpperCase()}
                       </span>
                   </button>
                   
                   {/* Right: Fused Capsule Generate Button */}
                   {/* Structure: [ [1] [Button] ] inside a single gray capsule */}
                   <div className="flex items-center h-9 bg-zinc-800 rounded-full p-0.5 border border-white/5 hover:border-white/10 transition-colors cursor-pointer group shadow-lg">
                       <span className="px-3 text-xs font-mono text-zinc-400 select-none group-hover:text-zinc-300 transition-colors">{batchCount}</span>
                       <button className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-sm">
                           <ArrowUp size={16} strokeWidth={2.5} />
                       </button>
                   </div>
               </div>

               {/* --- SETTINGS POPOVER --- */}
               {isSettingsOpen && (
                   <div 
                       ref={settingsRef}
                       className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-[280px] bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-2xl p-4 z-50 animate-in slide-in-from-bottom-2 fade-in duration-200"
                   >
                       {/* Arrow Tip */}
                       <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1.5 border-8 border-transparent border-t-[#1a1a1a]"></div>

                       {/* Section: Quality */}
                       <div className="mb-4">
                           <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-2 ml-1">画质</div>
                           <div className="flex bg-black/40 p-1 rounded-xl">
                               {QUALITY_OPTIONS.map((opt) => (
                                   <button
                                       key={opt.id}
                                       onClick={() => setQuality(opt.id)}
                                       className={`flex-1 py-1.5 text-[10px] font-medium rounded-lg transition-all
                                           ${quality === opt.id 
                                               ? 'bg-zinc-700 text-white shadow-sm' 
                                               : 'text-zinc-500 hover:text-zinc-300'}
                                       `}
                                   >
                                       {opt.label}
                                   </button>
                               ))}
                           </div>
                       </div>

                       {/* Section: Aspect Ratio */}
                       <div>
                           <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-2 ml-1">比例</div>
                           <div className="flex gap-2 h-[80px]">
                               <button 
                                   onClick={() => setAspectRatio('adaptive')}
                                   className={`flex-1 flex flex-col items-center justify-center gap-2 rounded-xl border transition-all
                                       ${aspectRatio === 'adaptive'
                                           ? 'bg-zinc-700 border-zinc-600 text-white'
                                           : 'bg-zinc-900/50 border-white/5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}
                                   `}
                               >
                                   <Scan size={18} />
                                   <span className="text-[10px] font-medium">自适应</span>
                               </button>
                               <div className="w-[120px] grid grid-cols-3 gap-1.5">
                                   {ASPECT_RATIOS.map((ratio) => (
                                       <button
                                           key={ratio.id}
                                           onClick={() => setAspectRatio(ratio.id)}
                                           title={ratio.label}
                                           className={`flex items-center justify-center rounded-lg border transition-all
                                               ${aspectRatio === ratio.id
                                                   ? 'bg-zinc-700 border-zinc-600 text-white'
                                                   : 'bg-zinc-900/50 border-white/5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}
                                           `}
                                       >
                                           {ratio.icon}
                                       </button>
                                   ))}
                               </div>
                           </div>
                       </div>
                   </div>
               )}
            </div>
         </div>
      )}
    </div>
  );
};

// --- Subcomponent: Feature Item ---
const FeatureItem = ({ icon, label }: { icon: React.ReactNode, label: string }) => (
  <div className="flex items-center gap-3 px-3 py-2 rounded-xl text-zinc-500 hover:text-zinc-200 hover:bg-white/5 cursor-pointer transition-all duration-200 group/item">
      <span className="opacity-70 group-hover/item:opacity-100 transition-opacity">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
  </div>
);