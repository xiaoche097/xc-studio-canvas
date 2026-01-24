import React, { useState } from 'react';
import { Plus, LayoutTemplate, MessageSquare, Image as ImageIcon, Sliders, Type, Video } from 'lucide-react';
import { NodeType } from '../types';

interface LeftSidebarProps {
  onAddNode: (type: NodeType) => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({ onAddNode }) => {
  const [showAddMenu, setShowAddMenu] = useState(false);

  return (
    <div className="fixed left-4 top-1/2 -translate-y-1/2 flex flex-col items-center py-5 gap-6 w-[64px] bg-[#1a1a1a] rounded-full border border-white/10 shadow-2xl z-50">
      
      {/* Create Button (with Popover) */}
      <div className="relative">
        <button 
          onClick={() => setShowAddMenu(!showAddMenu)}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg shadow-white/10 group z-50 relative
            ${showAddMenu ? 'bg-blue-600 text-white rotate-45' : 'bg-white hover:bg-gray-200 text-black'}
          `}
        >
          <Plus size={24} strokeWidth={2.5} className="transition-transform" />
        </button>

        {/* Add Nodes Menu Popover */}
        {showAddMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowAddMenu(false)}></div>
            <div className="absolute left-full top-0 ml-4 w-32 bg-[#222] border border-white/10 rounded-xl shadow-xl p-1 z-50 flex flex-col gap-1 animate-in slide-in-from-left-2 fade-in duration-200">
                <AddMenuItem icon={<Type size={14} />} label="文本节点" onClick={() => { onAddNode('text'); setShowAddMenu(false); }} />
                <AddMenuItem icon={<ImageIcon size={14} />} label="图片节点" onClick={() => { onAddNode('image'); setShowAddMenu(false); }} />
                <AddMenuItem icon={<Video size={14} />} label="视频节点" onClick={() => { onAddNode('video'); setShowAddMenu(false); }} />
            </div>
          </>
        )}
      </div>

      {/* Tools Group - Filtered as requested */}
      <div className="flex flex-col gap-6 items-center w-full">
        <SidebarIcon icon={<LayoutTemplate size={22} />} label="资产" />
        <SidebarIcon icon={<ImageIcon size={22} />} label="历史图片" />
        <SidebarIcon icon={<MessageSquare size={22} />} label="评论" />
        <SidebarIcon icon={<Sliders size={22} />} label="高级编辑" />
      </div>

      {/* Spacer */}
      <div className="h-2" />

      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 ring-2 ring-white/10 cursor-pointer hover:ring-white/30 transition-all shadow-lg"></div>
    </div>
  );
};

const SidebarIcon = ({ icon, label }: { icon: React.ReactNode, label: string }) => (
  <button className="text-gray-500 hover:text-white transition-colors group relative flex items-center justify-center w-full">
    {icon}
    {/* Tooltip */}
    <span className="absolute left-full ml-4 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-white/10 pointer-events-none z-[60]">
      {label}
    </span>
  </button>
);

const AddMenuItem = ({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) => (
  <button onClick={onClick} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-left">
    {icon}
    <span>{label}</span>
  </button>
);