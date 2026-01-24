import React, { useEffect, useRef } from 'react';
import { Upload, PlusSquare, Undo, Redo, Clipboard } from 'lucide-react';
import { NodeType } from '../types';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onSelect: (type: NodeType) => void;
  onUpload: () => void;
  onAddAsset: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onPaste: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ 
  x, y, 
  onClose, 
  onSelect,
  onUpload,
  onAddAsset,
  onUndo,
  onRedo,
  onPaste,
  canUndo,
  canRedo
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
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
      className="fixed z-[60] bg-[#1e1e1e] border border-[#333] rounded-xl shadow-2xl w-[200px] overflow-hidden animate-in fade-in zoom-in-95 duration-100"
      style={{ top: y, left: x }}
    >
      {/* Section 1: Upload */}
      <div className="p-1.5 border-b border-[#333]">
         <MenuItem 
            icon={<Upload size={14} />} 
            label="上传资源" 
            subLabel="图片、文本、视频、音频"
            onClick={() => { onUpload(); onClose(); }}
         />
      </div>

      {/* Section 2: Assets */}
      <div className="p-1.5 border-b border-[#333]">
         <MenuItem 
            icon={<PlusSquare size={14} />} 
            label="添加资产" 
            onClick={() => { onAddAsset(); onClose(); }}
         />
      </div>

      {/* Section 3: Edit Actions */}
      <div className="p-1.5">
         <div className="flex items-center gap-1">
             <div className="flex-1">
                <MenuItem 
                  icon={<Undo size={14} />} 
                  label="撤销" 
                  onClick={() => { onUndo(); onClose(); }} 
                  disabled={!canUndo}
                />
             </div>
             <div className="flex-1">
                <MenuItem 
                  icon={<Redo size={14} />} 
                  label="重做" 
                  onClick={() => { onRedo(); onClose(); }} 
                  disabled={!canRedo}
                />
             </div>
         </div>
         <MenuItem 
            icon={<Clipboard size={14} />} 
            label="粘贴" 
            shortcut="Ctrl+V" 
            onClick={() => { onPaste(); onClose(); }} 
         />
      </div>
    </div>
  );
};

interface MenuItemProps {
    icon: React.ReactNode;
    label: string;
    subLabel?: string;
    shortcut?: string;
    onClick?: () => void;
    disabled?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, label, subLabel, shortcut, onClick, disabled }) => (
  <button 
    onClick={(e) => { 
        if (!disabled) onClick?.(); 
        e.stopPropagation();
    }}
    disabled={disabled}
    className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-lg text-left transition-colors group
      ${disabled ? 'opacity-50 cursor-not-allowed text-gray-600' : 'hover:bg-blue-600 hover:text-white text-gray-300 cursor-pointer'}
    `}
  >
    <div className={`text-gray-500 ${!disabled && 'group-hover:text-white/80'}`}>{icon}</div>
    <div className="flex-1">
        <div className="flex items-center justify-between">
            <span className="text-xs font-medium">{label}</span>
            {shortcut && <span className={`text-[9px] font-mono ${!disabled ? 'text-gray-500 group-hover:text-white/60' : 'text-gray-600'}`}>{shortcut}</span>}
        </div>
        {subLabel && <div className={`text-[9px] ${!disabled ? 'text-gray-500 group-hover:text-white/70' : 'text-gray-600'}`}>{subLabel}</div>}
    </div>
  </button>
);