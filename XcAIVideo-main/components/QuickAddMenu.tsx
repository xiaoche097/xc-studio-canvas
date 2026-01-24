import React, { useEffect, useRef } from 'react';
import { Type, Image, Video, Music, PenTool, Upload } from 'lucide-react';
import { NodeType } from '../types';

interface QuickAddMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onSelect: (type: NodeType) => void;
  onUpload: () => void;
}

export const QuickAddMenu: React.FC<QuickAddMenuProps> = ({ x, y, onClose, onSelect, onUpload }) => {
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

  return (
    <div 
      ref={menuRef}
      className="fixed z-[60] bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl w-[240px] overflow-hidden animate-in fade-in zoom-in-95 duration-100 p-2"
      style={{ top: y, left: x }}
    >
      <div className="text-[11px] text-gray-500 font-medium px-2 py-1.5 mb-0.5">添加节点</div>
      
      <MenuItem 
        icon={<Type size={16} />} 
        label="文本" 
        subLabel="脚本、广告词、品牌文案"
        onClick={() => onSelect('text')} 
      />
      <MenuItem 
        icon={<Image size={16} />} 
        label="图片" 
        onClick={() => onSelect('image')} 
      />
      <MenuItem 
        icon={<Video size={16} />} 
        label="视频" 
        onClick={() => onSelect('video')} 
      />
      <MenuItem 
        icon={<Music size={16} />} 
        label="音频" 
        badge="Beta"
        onClick={() => onSelect('audio')} 
      />
      <MenuItem 
        icon={<PenTool size={16} />} 
        label="图片编辑器" 
        onClick={() => { /* Placeholder mapping to image node for now */ onSelect('image'); }} 
      />

      <div className="text-[11px] text-gray-500 font-medium px-2 py-1.5 mt-2 mb-0.5">添加资源</div>
      <MenuItem 
        icon={<Upload size={16} />} 
        label="上传" 
        onClick={onUpload} 
      />
    </div>
  );
};

interface MenuItemProps {
    icon: React.ReactNode;
    label: string;
    subLabel?: string;
    badge?: string;
    onClick: () => void;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, label, subLabel, badge, onClick }) => (
  <button 
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors text-left group"
  >
    <div className="w-9 h-9 rounded-lg bg-[#252525] flex items-center justify-center text-gray-400 group-hover:text-white transition-colors border border-white/5">
        {icon}
    </div>
    <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-200 group-hover:text-white">{label}</span>
            {badge && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-gray-400 border border-white/5">{badge}</span>}
        </div>
        {subLabel && <div className="text-[10px] text-gray-500 truncate mt-0.5">{subLabel}</div>}
    </div>
  </button>
);