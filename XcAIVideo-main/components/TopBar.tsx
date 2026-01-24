import React from 'react';
import { Share2, Users, Coins } from 'lucide-react';
import { APP_LOGO_URL } from '../constants';

interface TopBarProps {
  onBack?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onBack }) => {
  return (
    <div className="fixed top-0 left-0 w-full h-16 px-6 flex items-center justify-between z-40 pointer-events-none">
      {/* Left: Logo & Title */}
      <div className="flex items-center gap-4 pointer-events-auto">
        <div 
          onClick={onBack}
          className="flex items-center gap-2 select-none group cursor-pointer"
        >
          {/* Updated Logo: Image from Assets */}
          <img 
            src={APP_LOGO_URL} 
            alt="XcAIVideo" 
            className="h-8 w-auto object-contain rounded-md shadow-lg group-hover:scale-105 transition-transform" 
          />
          <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-rose-400">
            XcAIVideo
          </span>
        </div>
        <div className="h-4 w-px bg-white/10"></div>
        <span className="text-sm text-gray-400 hover:text-white cursor-pointer transition-colors">
          未命名项目
        </span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3 pointer-events-auto">
        {/* Removed Earn Tapes Button */}
        <TopButton icon={<Users size={14} />} label="社区" />
        <div className="h-4 w-px bg-white/10 mx-1"></div>
        <button className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-md transition-all flex items-center gap-2 shadow-lg shadow-blue-900/20 active:scale-95">
          <Share2 size={12} />
          分享
        </button>
      </div>
    </div>
  );
};

const TopButton = ({ icon, label }: { icon: React.ReactNode, label: string }) => (
  <button className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/5 bg-[#1a1a1a]/50 hover:bg-[#2a2a2a] text-gray-300 hover:text-white text-xs transition-colors backdrop-blur-md">
    {icon}
    <span>{label}</span>
  </button>
);