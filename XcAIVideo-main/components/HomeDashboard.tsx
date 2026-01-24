import React from 'react';
import { 
  Users, Layout, Zap, Image, Video, PenTool, 
  Search, Smile, Sparkles, MoveRight, ChevronRight,
  Layers, Library
} from 'lucide-react';
import { APP_LOGO_URL } from '../constants';

interface HomeDashboardProps {
  onCreateProject: () => void;
  onNavigate: (view: 'home' | 'workspace') => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({ onCreateProject, onNavigate }) => {
  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans overflow-y-auto overflow-x-hidden pb-20">
      {/* Top Nav */}
      <nav className="sticky top-0 z-50 bg-[#050505]/80 backdrop-blur-md border-b border-white/5 px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          {/* Logo - XC Pink Gradient */}
          <div className="flex items-center gap-2 font-bold text-xl cursor-pointer select-none">
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
            <button 
              onClick={() => onNavigate('workspace')}
              className="hover:text-white transition-colors flex items-center gap-1.5"
            >
              工作空间
            </button>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-4 text-sm">
           <span className="text-gray-400 hover:text-white cursor-pointer px-2">简体中文</span>
           <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 border border-white/10 ring-2 ring-transparent hover:ring-white/20 transition-all cursor-pointer"></div>
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto px-6 pt-8 space-y-12">
        
        {/* Hero Banners */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <BannerCard 
             bgClass="bg-gradient-to-br from-blue-900/40 via-[#0a0a0a] to-blue-600/5" 
             title="多角度编辑" 
             desc="一张图 N 种视角任你选"
             badge="NEW"
           />
           <BannerCard 
             bgClass="bg-gradient-to-br from-zinc-900 via-[#0a0a0a] to-zinc-800/50" 
             title="团队管理 2.0" 
             desc="创作无缝协同"
           />
           <BannerCard 
             bgClass="bg-gradient-to-br from-[#1a1a1a] via-[#0a0a0a] to-gray-800/30" 
             title="动作资产库" 
             desc="Kling 动作迁移"
           />
        </div>

        {/* Features Grid */}
        <section>
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            特色功能
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-auto lg:h-[360px]">
            {/* Main CTA - Create Project */}
            <div 
              onClick={onCreateProject}
              className="relative bg-gradient-to-br from-blue-600 to-purple-700 rounded-2xl p-10 overflow-hidden cursor-pointer group hover:shadow-2xl hover:shadow-purple-500/20 transition-all border border-white/10 flex flex-col justify-between"
            >
              <div className="absolute top-0 right-0 p-40 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none group-hover:bg-white/15 transition-colors"></div>
              
              <div>
                <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-3xl mb-6 shadow-inner border border-white/20 group-hover:scale-105 group-hover:rotate-6 transition-transform duration-300">
                  ✏️
                </div>
                <h3 className="text-4xl font-bold mb-3 tracking-tight">创建新项目</h3>
                <p className="text-blue-100/80 text-lg font-light">无限画布，自由挥洒创意</p>
              </div>
              
              <button className="self-start px-8 py-3 bg-white text-blue-900 rounded-full font-bold text-sm flex items-center gap-2 group-hover:gap-4 transition-all shadow-lg hover:shadow-white/20">
                立即尝试 <MoveRight size={18} />
              </button>
            </div>

            {/* Small Feature Cards Grid (2x4) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3">
               <FeatureCard icon={<PenTool size={18} className="text-pink-400" />} label="涂鸦生视频" />
               <FeatureCard icon={<Image size={18} className="text-green-400" />} label="涂鸦生图" />
               <FeatureCard icon={<Users size={18} className="text-orange-400" />} label="姿势控制" />
               <FeatureCard icon={<Sparkles size={18} className="text-cyan-400" />} label="美肤与超清" />
               
               <FeatureCard icon={<Video size={18} className="text-purple-400" />} label="一键拉片" />
               <FeatureCard icon={<Layout size={18} className="text-yellow-400" />} label="分镜策划" />
               <FeatureCard icon={<Search size={18} className="text-red-400" />} label="找灵感" />
               <FeatureCard icon={<Smile size={18} className="text-blue-400" />} label="情绪板策划" />
            </div>
          </div>
        </section>

        {/* Workflows */}
        <section>
          <div className="flex items-center justify-between mb-6 px-1">
             <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-gray-500">工作流</h2>
                <ChevronRight size={20} className="text-gray-600" />
                <h2 className="text-xl font-semibold text-white">为你推荐</h2>
             </div>
             <button className="text-xs text-gray-400 hover:text-white transition-colors bg-[#1a1a1a] px-3 py-1.5 rounded-full border border-white/5">查看全部</button>
          </div>
          
          <div className="flex gap-5 overflow-x-auto pb-6 scrollbar-hide snap-x">
            <WorkflowCard title="一键电商组图" hot="1.2k" image="from-orange-500/20 to-red-500/20" />
            <WorkflowCard title="多镜头电影分镜" hot="890" image="from-blue-500/20 to-cyan-500/20" />
            <WorkflowCard title="角色一致性生成" hot="2.3k" image="from-purple-500/20 to-pink-500/20" />
            <WorkflowCard title="Logo 动态化" hot="450" image="from-green-500/20 to-emerald-500/20" />
            <WorkflowCard title="儿童绘本制作" hot="670" image="from-yellow-500/20 to-amber-500/20" />
            <div className="w-8 shrink-0"></div> {/* Spacer */}
          </div>
        </section>

      </main>
    </div>
  );
};

// --- Subcomponents ---

const BannerCard = ({ bgClass, title, desc, badge }: { bgClass: string, title: string, desc: string, badge?: string }) => (
  <div className={`relative h-48 rounded-xl p-6 border border-white/5 overflow-hidden group cursor-pointer ${bgClass}`}>
    <div className="relative z-10 h-full flex flex-col justify-end">
        <h3 className="text-xl font-bold mb-1">{title}</h3>
        <p className="text-sm text-gray-400 group-hover:text-gray-200 transition-colors">{desc}</p>
    </div>
    {badge && (
      <span className="absolute top-4 right-4 px-2 py-0.5 bg-blue-500 text-[10px] font-bold rounded uppercase tracking-wider text-white shadow-lg shadow-blue-500/40">
        {badge}
      </span>
    )}
  </div>
);

const FeatureCard = ({ icon, label }: { icon: React.ReactNode, label: string }) => (
  <div className="bg-[#1a1a1a] hover:bg-[#222] border border-white/5 hover:border-white/10 rounded-xl p-4 flex flex-col items-start justify-center gap-3 cursor-pointer transition-all hover:translate-y-[-2px] group">
    <div className="p-2 rounded-lg bg-[#111] border border-white/5 group-hover:bg-[#1a1a1a] transition-colors">
        {icon}
    </div>
    <span className="text-sm font-medium text-gray-300 group-hover:text-white">{label}</span>
  </div>
);

const WorkflowCard = ({ title, hot, image }: { title: string, hot: string, image: string }) => (
  <div className="min-w-[240px] h-[180px] bg-[#1a1a1a] rounded-xl border border-white/5 overflow-hidden cursor-pointer hover:border-white/20 transition-all group snap-start">
    {/* Placeholder Image */}
    <div className={`h-[110px] bg-gradient-to-br ${image} w-full relative`}>
        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
    </div>
    <div className="p-3">
        <h4 className="text-sm font-medium text-gray-200 mb-2 truncate">{title}</h4>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Zap size={12} className="text-yellow-500 fill-yellow-500" />
            <span>{hot} 热度</span>
        </div>
    </div>
  </div>
);