import React from 'react';
import { 
  Search, Plus, ArrowUpDown, Layers, Library
} from 'lucide-react';
import { APP_LOGO_URL } from '../constants';

interface WorkspaceDashboardProps {
  onNavigate: (view: 'home' | 'workspace') => void;
  onOpenProject: () => void;
}

export const WorkspaceDashboard: React.FC<WorkspaceDashboardProps> = ({ onNavigate, onOpenProject }) => {
  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans overflow-hidden flex flex-col">
      {/* Top Nav - Unified with HomeDashboard */}
      <nav className="sticky top-0 z-50 bg-[#050505]/80 backdrop-blur-md border-b border-white/5 px-6 h-16 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-8">
          {/* Logo - Navigates to Home */}
          <div 
             onClick={() => onNavigate('home')}
             className="flex items-center gap-2 font-bold text-xl cursor-pointer select-none"
          >
            <img 
              src={APP_LOGO_URL} 
              alt="XC" 
              className="h-8 w-auto object-contain rounded-md shadow-lg shadow-pink-500/20"
            />
            XcAIVideo
          </div>
          
          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-400 font-medium">
             <button className="hover:text-white transition-colors flex items-center gap-1.5">
              <Library size={14}/> 资产库
            </button>
            <button className="hover:text-white transition-colors flex items-center gap-1.5">
              <Layers size={14}/> 工作流
            </button>
            <button className="text-white flex items-center gap-1.5 border-b-2 border-white py-4">
              工作空间
            </button>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-4 text-sm">
           <span className="text-gray-400 hover:text-white cursor-pointer px-2">简体中文</span>
           <div className="w-8 h-8 rounded-full bg-[#7c3aed] flex items-center justify-center text-xs font-bold border border-white/10 cursor-pointer">yc</div>
        </div>
      </nav>

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-8">
        
        {/* Toolbar Line */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-8 text-sm font-medium">
                <button className="text-blue-400 border-b-2 border-blue-400 pb-2">我的画布</button>
                <button className="text-gray-500 hover:text-gray-300 pb-2">团队画布 [xiaoche097的团队]</button>
            </div>

            <div className="flex items-center gap-4">
                <button className="flex items-center gap-1.5 text-xs text-gray-300 font-medium hover:text-white transition-colors">
                    更新时间 <ArrowUpDown size={12} className="text-gray-500" />
                </button>
                
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input 
                        type="text" 
                        placeholder="搜索" 
                        className="bg-[#111] border border-white/10 rounded-md h-8 pl-9 pr-4 text-xs text-gray-300 focus:outline-none focus:border-white/20 w-48 transition-all"
                    />
                </div>

                <button 
                  onClick={onOpenProject}
                  className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium px-4 py-2 rounded-md flex items-center gap-1.5 transition-colors shadow-lg shadow-blue-500/20"
                >
                    <Plus size={14} /> 新建项目
                </button>
            </div>
        </div>

        {/* Project Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {/* New Project Card Only - Removed Untitled Examples */}
            <div 
                onClick={onOpenProject}
                className="aspect-[4/3] bg-[#111] rounded-lg border border-white/5 hover:border-white/20 flex flex-col items-center justify-center gap-3 cursor-pointer group transition-all"
            >
                <div className="w-10 h-10 rounded-full bg-[#1a1a1a] flex items-center justify-center group-hover:bg-[#222] transition-colors">
                    <Plus size={20} className="text-gray-400 group-hover:text-white" />
                </div>
                <span className="text-xs text-gray-500 font-medium group-hover:text-gray-300">新建项目</span>
            </div>
        </div>

      </main>
    </div>
  );
};
