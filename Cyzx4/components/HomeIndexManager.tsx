import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  ImageIcon,
  Video,
  Plus,
  ChevronDown,
  ArrowRight,
  Sparkles,
  Layers,
  Wand2,
  Clock,
  Trash2,
  Wrench,
} from 'lucide-react';
import { AppMode } from '../types';
import { storageService, Project } from '../../services/storageService';

interface HomeIndexManagerProps {
  onOpenFeature: (mode: AppMode) => void;
  onSwitchToCreation: () => void;
}

export const HomeIndexManager: React.FC<HomeIndexManagerProps> = ({
  onOpenFeature,
  onSwitchToCreation,
}) => {
  const [activeTab, setActiveTab] = useState<'agent' | 'image' | 'video'>('agent');
  const [promptInput, setPromptInput] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [selectedFeature, setSelectedFeature] = useState<{ mode: AppMode; label: string } | null>(null);
  const [isFeatureDropdownOpen, setIsFeatureDropdownOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 快捷功能模式选择列表
  const FEATURE_OPTIONS: Array<{ mode: AppMode; label: string; description: string }> = [
    { mode: AppMode.PRODUCT_VIDEO, label: '产品展示视频', description: '从产品素材到分镜方案，生成视频' },
    { mode: AppMode.ECOMMERCE_HERO, label: '电商主图生成', description: '高转化电商白底/场景主图' },
    { mode: AppMode.PLANNING, label: '电商详情图生成', description: '图文排版，多卖点视觉策划' },
    { mode: AppMode.UNIVERSAL_TRY_ON, label: '通用模特试穿', description: '一键模特/人台服装替换' },
    { mode: AppMode.MODEL_POSE_FISSION, label: '摄影实验室', description: '预设高级商业摄影大片' },
    { mode: AppMode.SCENE_GENERATION, label: '爆款复刻', description: '复刻优秀爆款光影与构图' },
  ];

  // 加载最近项目
  useEffect(() => {
    loadProjects();
    const handleUpdate = () => loadProjects();
    window.addEventListener('project-cache-updated', handleUpdate);
    return () => window.removeEventListener('project-cache-updated', handleUpdate);
  }, []);

  const loadProjects = async () => {
    try {
      const list = await storageService.getAllProjects();
      setProjects(list.slice(0, 6));
    } catch (e) {
      console.error('加载项目失败:', e);
    }
  };

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsFeatureDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setImages((prev) => [...prev, reader.result as string].slice(0, 3));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStartCreation = () => {
    if (selectedFeature) {
      onOpenFeature(selectedFeature.mode);
      return;
    }

    if (activeTab === 'video') {
      onOpenFeature(AppMode.PRODUCT_VIDEO);
    } else if (activeTab === 'image') {
      onOpenFeature(AppMode.ECOMMERCE_HERO);
    } else {
      onOpenFeature(AppMode.ECOMMERCE_HERO);
    }
  };

  const handleCreateNewProject = async () => {
    try {
      const newProjId = `project-${Date.now()}`;
      await storageService.saveProject({
        id: newProjId,
        type: 'SEAT_COVER',
        createdAt: Date.now(),
        thumbnail: '',
        assets: { original: [], generated: [] },
        metadata: { prompt: promptInput || 'Untitled' },
      });
      await loadProjects();
      onOpenFeature(AppMode.ECOMMERCE_HERO);
    } catch (e) {
      onSwitchToCreation();
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await storageService.deleteProject(id);
      loadProjects();
    } catch (e) {
      console.error('删除项目失败:', e);
    }
  };

  return (
    <main className="flex-1 overflow-y-auto no-scrollbar min-w-0 bg-[#f8f9fa] text-slate-800 font-sans p-6 md:p-10 select-none">
      <div className="max-w-4xl mx-auto space-y-7">

        {/* 1. 顶部 Main Header */}
        <div className="text-center space-y-2 pt-2">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center justify-center gap-2">
            一站式创作{' '}
            <span className="bg-gradient-to-r from-blue-500 via-indigo-500 to-pink-500 bg-clip-text text-transparent">
              AI Agent
            </span>
          </h1>
          <p className="text-slate-400 text-xs font-normal">
            描述您想要的内容，选择您想要的功能，开始创作
          </p>
        </div>

        {/* 2. 核心大输入框卡片与左上方 Tabs 组合包 ( Tabs 靠左对齐与输入框齐平 ) */}
        <div className="w-full space-y-2">
          
          {/* 左上角靠左 Tabs */}
          <div className="flex items-center gap-6 pl-3">
            <button
              type="button"
              onClick={() => setActiveTab('agent')}
              className={`flex items-center gap-1.5 pb-1 text-xs transition-all relative ${
                activeTab === 'agent'
                  ? 'text-slate-900 font-bold border-b-2 border-black'
                  : 'text-slate-400 font-normal hover:text-slate-600'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>AI Agent</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('image')}
              className={`flex items-center gap-1.5 pb-1 text-xs transition-all relative ${
                activeTab === 'image'
                  ? 'text-slate-900 font-bold border-b-2 border-black'
                  : 'text-slate-400 font-normal hover:text-slate-600'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>图片生成</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('video')}
              className={`flex items-center gap-1.5 pb-1 text-xs transition-all relative ${
                activeTab === 'video'
                  ? 'text-slate-900 font-bold border-b-2 border-black'
                  : 'text-slate-400 font-normal hover:text-slate-600'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>视频生成</span>
            </button>
          </div>

          {/* 核心大输入框外卡片 */}
          <div className="relative rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_4px_30px_rgba(0,0,0,0.02)] space-y-4">
            
            {/* 内嵌浅灰色面板槽 (bg-[#f7f8fa]) */}
            <div className="rounded-2xl bg-[#f7f8fa] border border-slate-100 p-4 min-h-[145px] flex gap-4 items-start">
              
              {/* 左侧极其标志性的“倾斜白色虚线上传框 + 细线 + 图标” */}
              <div className="relative shrink-0 pt-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  multiple
                  accept="image/*"
                  className="hidden"
                />

                {images.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {images.map((img, idx) => (
                      <div key={idx} className="relative w-20 h-24 rounded-2xl overflow-hidden border border-slate-200 group shadow-xs">
                        <img src={img} alt="上传图预览" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {images.length < 3 && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-20 h-10 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:text-slate-700 transition"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-[84px] h-[108px] rounded-[18px] border-2 border-dashed border-slate-200/90 hover:border-slate-400 bg-white shadow-xs flex flex-col items-center justify-center text-slate-400 transition-all transform rotate-3 hover:rotate-0"
                  >
                    <Plus className="w-5 h-5 text-slate-400 stroke-[1.5]" />
                  </button>
                )}
              </div>

              {/* 中间多行文本框 (完全匹配参考图 Placeholder 文本) */}
              <div className="flex-1 min-w-0 pt-2">
                <textarea
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  placeholder="用一句话描述你想完成的事，例如：帮我生成电商主图"
                  className="w-full h-28 bg-transparent border-none outline-none resize-none text-slate-800 placeholder:text-slate-400/90 font-medium text-xs md:text-sm leading-relaxed"
                />
              </div>
            </div>

            {/* 底部控制行：左侧[选择功能 v] 胶囊 + 右侧[-> 开始创作] 黑胶囊 */}
            <div className="flex items-center justify-between px-1 pt-1">
              
              {/* 左下角：选择功能 v 下拉 */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsFeatureDropdownOpen(!isFeatureDropdownOpen)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-slate-200/80 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                >
                  <Wrench className="w-3.5 h-3.5 text-slate-500" />
                  <span>{selectedFeature ? selectedFeature.label : '选择功能'}</span>
                  <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isFeatureDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isFeatureDropdownOpen && (
                  <div className="absolute left-0 bottom-full mb-2 w-56 rounded-2xl border border-slate-200 bg-white shadow-xl p-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">匹配功能</div>
                    {FEATURE_OPTIONS.map((item) => (
                      <button
                        key={item.mode}
                        type="button"
                        onClick={() => {
                          setSelectedFeature(item);
                          setIsFeatureDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl transition flex flex-col gap-0.5 ${
                          selectedFeature?.mode === item.mode
                            ? 'bg-slate-100 text-slate-900 font-bold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span className="text-xs font-bold">{item.label}</span>
                        <span className="text-[10px] text-slate-400 truncate">{item.description}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 右下角：纯黑胶囊开始创作按钮 */}
              <button
                type="button"
                onClick={handleStartCreation}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-black hover:bg-slate-800 text-white text-xs font-bold shadow-md active:scale-95 transition-all"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>开始创作</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3. 推荐快捷功能 3 大卡片 (对齐卡片宽度) */}
        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* 卡片 1: 产品展示视频 */}
          <div
            onClick={() => onOpenFeature(AppMode.PRODUCT_VIDEO)}
            className="group cursor-pointer rounded-2xl bg-[#eaecf0] hover:bg-[#e2e4e9] p-4 text-center transition-all duration-300 flex flex-col items-center justify-between min-h-[140px]"
          >
            <span className="text-xs font-extrabold text-slate-800 tracking-tight">产品展示视频</span>
            
            <div className="w-full mt-3 flex justify-center items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
              <div className="w-14 h-16 rounded-lg bg-white shadow-xs overflow-hidden border border-slate-200/50 transform -rotate-6 group-hover:-rotate-12 transition-transform">
                <img src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=200&q=80" className="w-full h-full object-cover" alt="展示视频" />
              </div>
              <div className="w-16 h-18 rounded-lg bg-white shadow-md overflow-hidden border border-slate-200/80 z-10 scale-105 group-hover:scale-110 transition-transform">
                <img src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=200&q=80" className="w-full h-full object-cover" alt="展示视频" />
              </div>
              <div className="w-14 h-16 rounded-lg bg-white shadow-xs overflow-hidden border border-slate-200/50 transform rotate-6 group-hover:rotate-12 transition-transform">
                <img src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=200&q=80" className="w-full h-full object-cover" alt="展示视频" />
              </div>
            </div>
          </div>

          {/* 卡片 2: 电商主图生成 */}
          <div
            onClick={() => onOpenFeature(AppMode.ECOMMERCE_HERO)}
            className="group cursor-pointer rounded-2xl bg-[#eaecf0] hover:bg-[#e2e4e9] p-4 text-center transition-all duration-300 flex flex-col items-center justify-between min-h-[140px]"
          >
            <span className="text-xs font-extrabold text-slate-800 tracking-tight">电商主图生成</span>
            
            <div className="w-full mt-3 flex justify-center items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
              <div className="w-14 h-16 rounded-lg bg-white shadow-xs overflow-hidden border border-slate-200/50 transform -rotate-6 group-hover:-rotate-12 transition-transform">
                <img src="https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=200&q=80" className="w-full h-full object-cover" alt="电商主图" />
              </div>
              <div className="w-16 h-18 rounded-lg bg-white shadow-md overflow-hidden border border-slate-200/80 z-10 scale-105 group-hover:scale-110 transition-transform">
                <img src="https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=200&q=80" className="w-full h-full object-cover" alt="电商主图" />
              </div>
              <div className="w-14 h-16 rounded-lg bg-white shadow-xs overflow-hidden border border-slate-200/50 transform rotate-6 group-hover:rotate-12 transition-transform">
                <img src="https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=200&q=80" className="w-full h-full object-cover" alt="电商主图" />
              </div>
            </div>
          </div>

          {/* 卡片 3: 电商详情图生成 */}
          <div
            onClick={() => onOpenFeature(AppMode.PLANNING)}
            className="group cursor-pointer rounded-2xl bg-[#eaecf0] hover:bg-[#e2e4e9] p-4 text-center transition-all duration-300 flex flex-col items-center justify-between min-h-[140px]"
          >
            <span className="text-xs font-extrabold text-slate-800 tracking-tight">电商详情图生成</span>
            
            <div className="w-full mt-3 flex justify-center items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
              <div className="w-14 h-16 rounded-lg bg-white shadow-xs overflow-hidden border border-slate-200/50 transform -rotate-6 group-hover:-rotate-12 transition-transform">
                <img src="https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=200&q=80" className="w-full h-full object-cover" alt="详情图" />
              </div>
              <div className="w-16 h-18 rounded-lg bg-white shadow-md overflow-hidden border border-slate-200/80 z-10 scale-105 group-hover:scale-110 transition-transform">
                <img src="https://images.unsplash.com/photo-1560343090-f0409e92791a?auto=format&fit=crop&w=200&q=80" className="w-full h-full object-cover" alt="详情图" />
              </div>
              <div className="w-14 h-16 rounded-lg bg-white shadow-xs overflow-hidden border border-slate-200/50 transform rotate-6 group-hover:rotate-12 transition-transform">
                <img src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=200&q=80" className="w-full h-full object-cover" alt="详情图" />
              </div>
            </div>
          </div>

        </div>

        {/* 4. 最近项目 (Recent Projects) 模块 */}
        <div className="w-full pt-4 space-y-3">
          
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900">最近项目</h2>

            <button
              type="button"
              onClick={handleCreateNewProject}
              className="flex items-center gap-1 px-3 py-1 rounded-full bg-[#eaecf0] hover:bg-[#e0e2e7] text-slate-700 text-xs font-semibold transition"
            >
              <Plus className="w-3 h-3 text-slate-600" />
              <span>新建项目</span>
            </button>
          </div>

          {/* 最近项目卡片列表 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            
            {/* 项目列表渲染 */}
            {projects.map((proj, idx) => {
              const dateStr = new Date(proj.createdAt).toLocaleDateString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              });

              const projectName = proj.metadata?.name || proj.metadata?.prompt || `画布-${idx + 1}`;

              return (
                <div
                  key={proj.id}
                  onClick={() => onOpenFeature(AppMode.ECOMMERCE_HERO)}
                  className="group cursor-pointer rounded-2xl bg-white border border-slate-200/60 p-3 shadow-2xs hover:shadow-md transition-all duration-300 relative flex flex-col justify-between"
                >
                  <div className="w-full aspect-[16/10] rounded-xl bg-[#e9ecf2] relative flex items-center justify-center overflow-hidden mb-3">
                    {proj.thumbnail ? (
                      <img src={proj.thumbnail} alt={projectName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-20 h-10 rounded-xl bg-white/90 shadow-2xs border border-white/60" />
                    )}

                    <button
                      type="button"
                      onClick={(e) => handleDeleteProject(e, proj.id)}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      title="删除项目"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-900 truncate">
                      {projectName}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-normal mt-0.5">
                      更新于 {dateStr}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* 当项目不足时提供默认占位演示项目 */}
            {projects.length === 0 && (
              <>
                <div className="rounded-2xl bg-white border border-slate-200/60 p-3 shadow-2xs">
                  <div className="w-full aspect-[16/10] rounded-xl bg-[#e9ecf2] flex items-center justify-center mb-3">
                    <div className="w-20 h-10 rounded-xl bg-white/90 shadow-2xs border border-white/60" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 truncate">鸡已飞0个国家 留子国际学校华籍美...</h4>
                  <p className="text-[10px] text-slate-400 font-normal mt-0.5">更新于 08-21 15:20</p>
                </div>

                <div className="rounded-2xl bg-white border border-slate-200/60 p-3 shadow-2xs">
                  <div className="w-full aspect-[16/10] rounded-xl bg-[#e9ecf2] flex items-center justify-center mb-3">
                    <div className="w-20 h-10 rounded-xl bg-white/90 shadow-2xs border border-white/60" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 truncate">画布-1</h4>
                  <p className="text-[10px] text-slate-400 font-normal mt-0.5">更新于 08-21 15:16</p>
                </div>

                <div className="rounded-2xl bg-white border border-slate-200/60 p-3 shadow-2xs">
                  <div className="w-full aspect-[16/10] rounded-xl bg-[#e9ecf2] flex items-center justify-center mb-3">
                    <div className="w-20 h-10 rounded-xl bg-white/90 shadow-2xs border border-white/60" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 truncate">Untitled</h4>
                  <p className="text-[10px] text-slate-400 font-normal mt-0.5">更新于 08-21 15:12</p>
                </div>
              </>
            )}

          </div>
        </div>

      </div>
    </main>
  );
};

export default HomeIndexManager;
