import React, { useEffect, useRef } from 'react';
import { Type, Image, Video, PenTool, Palette } from 'lucide-react';
import { NodeType } from '../types';

interface ConnectionMenuProps {
  x: number;
  y: number;
  type: 'source' | 'target';
  onClose: () => void;
  onSelect: (type: NodeType) => void;
}

export const ConnectionMenu: React.FC<ConnectionMenuProps> = ({ x, y, type, onClose, onSelect }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Menu for RIGHT port (Output) -> Generating new content downstream
  if (type === 'source') {
      return (
        <div 
          ref={menuRef}
          className="fixed z-[70] bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl w-[200px] overflow-hidden animate-in fade-in zoom-in-95 duration-100 p-1.5"
          style={{ top: y, left: x }}
        >
          <div className="text-[11px] text-gray-500 font-medium px-2 py-1.5 mb-1">引用该节点生成</div>
          
          <MenuItem 
            icon={<Type size={16} />} 
            label="文本生成" 
            subLabel="脚本、广告词、品牌文案"
            onClick={() => onSelect('text')} 
          />
          <MenuItem 
            icon={<Palette size={16} />} 
            label="图片生成" 
            onClick={() => onSelect('image')} 
          />
          <MenuItem 
            icon={<Video size={16} />} 
            label="视频生成" 
            onClick={() => onSelect('video')} 
          />
          <MenuItem 
            icon={<PenTool size={16} />} 
            label="图片编辑器" 
            onClick={() => onSelect('image')} 
          />
        </div>
      );
  }

  // Menu for LEFT port (Input) -> Adding context upstream
  return (
    <div 
      ref={menuRef}
      className="fixed z-[70] bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl w-[200px] overflow-hidden animate-in fade-in zoom-in-95 duration-100 p-1.5"
      style={{ top: y, left: x }}
    >
      <div className="text-[11px] text-gray-500 font-medium px-2 py-1.5 mb-1">添加上下文</div>
      
      <MenuItem 
        icon={<Type size={16} />} 
        label="文本生成" 
        subLabel="生成或编辑文本"
        onClick={() => onSelect('text')} 
      />
      <MenuItem 
        icon={<Image size={16} />} 
        label="图片处理" 
        onClick={() => onSelect('image')} 
      />
    </div>
  );
};

interface MenuItemProps {
    icon: React.ReactNode;
    label: string;
    subLabel?: string;
    onClick: () => void;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, label, subLabel, onClick }) => (
  <button 
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#252525] transition-colors text-left group"
  >
    <div className="w-8 h-8 rounded-lg bg-[#252525] group-hover:bg-[#333] flex items-center justify-center text-gray-400 group-hover:text-white transition-colors border border-white/5">
        {icon}
    </div>
    <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-200 group-hover:text-white">{label}</span>
        </div>
        {subLabel && <div className="text-[10px] text-gray-500 truncate mt-0.5">{subLabel}</div>}
    </div>
  </button>
);