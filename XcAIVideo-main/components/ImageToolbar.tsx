import React from 'react';
import { 
  RefreshCw, Eraser, Sparkles, Scan, Scissors, Box, 
  PenLine, Crop, Download, Maximize2 
} from 'lucide-react';
import { Position } from '../types';

interface ImageToolbarProps {
  position: Position;
  onAction: (action: string) => void;
}

export const ImageToolbar: React.FC<ImageToolbarProps> = ({ position, onAction }) => {
  return (
    <div 
      className="fixed z-40 flex items-center px-1.5 py-1 bg-[#1a1a1a] border border-[#333] rounded-full shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200"
      style={{ 
        left: position.x, 
        top: position.y,
        transform: 'translate(-50%, -100%) translateY(-16px)'
      }}
    >
      <ActionBtn icon={<RefreshCw size={13} />} label="重绘" onClick={() => onAction('redraw')} />
      <ActionBtn icon={<Eraser size={13} />} label="擦除" onClick={() => onAction('erase')} />
      <ActionBtn icon={<Sparkles size={13} />} label="增强" onClick={() => onAction('enhance')} />
      <ActionBtn icon={<Scan size={13} />} label="扩图" onClick={() => onAction('expand')} />
      <ActionBtn icon={<Scissors size={13} />} label="抠图" onClick={() => onAction('matting')} />
      <ActionBtn icon={<Box size={13} />} label="多角度" onClick={() => onAction('multi-angle')} />
      
      <div className="w-px h-4 bg-white/10 mx-1.5"></div>
      
      <IconBtn icon={<PenLine size={14} />} tooltip="标注" onClick={() => onAction('annotate')} />
      <IconBtn icon={<Crop size={14} />} tooltip="裁剪" onClick={() => onAction('crop')} />
      <IconBtn icon={<Download size={14} />} tooltip="下载" onClick={() => onAction('download')} />
      <IconBtn icon={<Maximize2 size={14} />} tooltip="全屏" onClick={() => onAction('fullscreen')} />
    </div>
  );
};

const ActionBtn = ({ icon, label, onClick }: any) => (
  <button 
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"
  >
    {icon}
    <span>{label}</span>
  </button>
);

const IconBtn = ({ icon, tooltip, onClick }: any) => (
  <button 
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    title={tooltip}
    className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
  >
    {icon}
  </button>
);