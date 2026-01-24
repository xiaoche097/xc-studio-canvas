import React from 'react';
import { Bookmark, MessageSquarePlus, BoxSelect, Trash2 } from 'lucide-react';
import { Position } from '../types';

interface SelectionToolbarProps {
  position: Position;
  count: number;
  onAddAsset: () => void;
  onAddToChat: () => void;
  onGroup: () => void;
  onDelete: () => void;
}

export const SelectionToolbar: React.FC<SelectionToolbarProps> = ({ 
  position, 
  count,
  onAddAsset, 
  onAddToChat, 
  onGroup,
  onDelete
}) => {
  return (
    <div 
      className="fixed z-40 flex items-center gap-1 p-1 bg-[#1e1e1e] border border-[#333] rounded-lg shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200"
      style={{ 
        left: position.x, 
        top: position.y,
        transform: 'translate(-50%, -100%) translateY(-12px)' // Center and move above
      }}
    >
      <div className="px-2 text-[10px] text-gray-500 font-medium border-r border-[#333] mr-1">
        已选 {count} 项
      </div>
      
      <ToolbarBtn 
        icon={<Bookmark size={14} />} 
        label="添加资产" 
        onClick={onAddAsset} 
        tooltip="保存为永久资产"
      />
      
      <ToolbarBtn 
        icon={<MessageSquarePlus size={14} />} 
        label="加入对话" 
        onClick={onAddToChat} 
        tooltip="发送至对话框"
      />
      
      <ToolbarBtn 
        icon={<BoxSelect size={14} />} 
        label="打组" 
        onClick={onGroup} 
      />

      <div className="w-px h-4 bg-[#333] mx-1"></div>

      <ToolbarBtn 
        icon={<Trash2 size={14} />} 
        label="删除" 
        onClick={onDelete} 
        danger
      />
    </div>
  );
};

const ToolbarBtn = ({ icon, label, onClick, tooltip, danger }: any) => (
  <button 
    onClick={onClick}
    className={`
      flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors relative group
      ${danger ? 'hover:bg-red-500/10 hover:text-red-400 text-gray-400' : 'hover:bg-blue-600 hover:text-white text-gray-300'}
    `}
    title={tooltip}
  >
    {icon}
    <span>{label}</span>
  </button>
);