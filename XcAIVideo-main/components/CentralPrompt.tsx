import React from 'react';
import { Sparkles } from 'lucide-react';

export const CentralPrompt: React.FC = () => {
  const chips = ["文生视频", "图片换背景", "首帧生成视频", "音频生视频", "工作流"];

  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-5 z-40 w-full max-w-2xl pointer-events-none select-none">
      {/* Main Input/Prompt Bar */}
      <div className="group relative pointer-events-auto cursor-pointer">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
        <div className="relative flex items-center gap-3 px-8 py-4 bg-[#1a1a1a]/90 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl min-w-[440px] justify-center transition-transform group-active:scale-[0.99]">
          <Sparkles className="text-white/80 w-4 h-4" />
          <span className="text-gray-400 text-[15px] font-light tracking-wide">
            ✨ <strong className="text-white font-medium">双击</strong> 画布自由生成，或查看工作流模板
          </span>
        </div>
      </div>

      {/* Quick Action Chips */}
      <div className="flex items-center gap-2 pointer-events-auto">
        {chips.map((label, index) => (
          <button 
            key={index}
            className="px-3.5 py-1.5 bg-[#1a1a1a]/60 hover:bg-[#2a2a2a] border border-white/5 hover:border-white/20 rounded-lg text-xs text-gray-400 hover:text-white transition-all backdrop-blur-md"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};