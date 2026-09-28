/**
 * 项目标题头部组件
 * 
 * 展示如何在组件中管理项目标题状态
 * 使用本地state管理输入，可以后续集成到store
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { ROUTES } from '../../../utils/routes';

interface ProjectHeaderProps {
  initialTitle?: string;
  onTitleChange?: (title: string) => void;
}

export const ProjectHeader: React.FC<ProjectHeaderProps> = ({
  initialTitle = '未命名',
  onTitleChange
}) => {
  const navigate = useNavigate();
  const [title, setTitle] = useState(initialTitle);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    onTitleChange?.(newTitle);
  };

  return (
    <div className="flex items-center gap-3 pointer-events-auto transition-all duration-300">
      {/* Logo Button */}
      <button
        onClick={() => navigate(ROUTES.landing)}
        className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md hover:scale-105 transition"
      >
        XC
      </button>

      {/* Project Title */}
      <div className="flex items-center gap-2 cursor-pointer hover:bg-white/50 px-3 py-1.5 rounded-full transition backdrop-blur-sm">
        <input
          className="font-medium text-gray-900 bg-transparent border-none focus:outline-none w-24 focus:w-48 transition-all"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="项目标题"
        />
        <ChevronDown size={14} className="text-gray-500" />
      </div>
    </div>
  );
};
