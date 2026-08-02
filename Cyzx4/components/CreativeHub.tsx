import React, { useMemo, useState } from 'react';
import {
  Sparkles,
  Search,
  Folder,
  Flame,
  Clock,
  ListTodo,
  BookOpen,
  Headphones,
  Eye,
  RotateCcw,
  Wand2,
  ChevronDown,
} from 'lucide-react';
import {
  CREATIVE_FEATURES,
  FEATURE_CATEGORIES,
  type CreativeFeature,
  type FeatureCategory,
} from '../featureRegistry';
import { AppMode } from '../types';

type CategoryFilter = 'all' | 'fashion' | 'video' | 'architecture' | 'food' | 'utility';

interface CreativeHubProps {
  onOpenFeature: (mode: AppMode) => void;
  onBack: () => void;
}

const normalizeSearch = (value: string) => value.trim().toLocaleLowerCase('zh-CN');

const PRODUCT_CATEGORY_TABS: Array<{ id: CategoryFilter; label: string }> = [
  { id: 'all', label: '全品类' },
  { id: 'fashion', label: '服装/模特/首饰' },
  { id: 'video', label: '视频专区' },
  { id: 'architecture', label: '建筑/室内设计' },
  { id: 'food', label: '餐饮/外卖' },
  { id: 'utility', label: '生活/工具' },
];

const FeatureCard: React.FC<{
  feature: CreativeFeature;
  onOpen: () => void;
  badge?: string;
}> = ({ feature, onOpen, badge }) => {
  return (
    <div
      onClick={onOpen}
      className="group cursor-pointer overflow-hidden rounded-2xl border border-slate-200/60 bg-white/90 shadow-2xs transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md dark:border-white/10 dark:bg-slate-900"
    >
      {/* 封面图片区域 (贴合图2质感) */}
      <div className="relative aspect-[16/10] overflow-hidden bg-[#fbf9f5] dark:bg-slate-800">
        <img
          src={feature.cover}
          alt={feature.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {badge && (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-2 py-0.5 text-[0.6rem] font-black text-white shadow-xs">
            {badge}
          </span>
        )}

        {/* 眼睛图标 (图2右下角样式) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="absolute bottom-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/85 text-slate-700 shadow-sm backdrop-blur-xs transition hover:bg-slate-900 hover:text-white dark:bg-slate-800/90 dark:text-slate-200 dark:hover:bg-white dark:hover:text-slate-900"
          title={`体验 ${feature.title}`}
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 标题与描述文本 */}
      <div className="p-3.5">
        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 group-hover:text-orange-600 transition-colors">
          {feature.title}
        </h3>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400 font-medium">
          {feature.description}
        </p>
      </div>
    </div>
  );
};

const CreativeHub: React.FC<CreativeHubProps> = ({ onOpenFeature, onBack }) => {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<CategoryFilter>('all');
  const [activeSidebarItem, setActiveSidebarItem] = useState('creation');

  const normalizedQuery = normalizeSearch(query);

  const filteredFeatures = useMemo(() => {
    return CREATIVE_FEATURES.filter((feature) => {
      if (activeTab === 'fashion' && feature.category !== 'model') return false;
      if (activeTab === 'video' && feature.mode !== 'PRODUCT_VIDEO') return false;
      if (activeTab === 'utility' && feature.category !== 'tools') return false;

      if (!normalizedQuery) return true;

      const searchable = [
        feature.title,
        feature.englishTitle,
        feature.description,
        ...feature.keywords,
      ]
        .join(' ')
        .toLocaleLowerCase('zh-CN');
      return searchable.includes(normalizedQuery);
    });
  }, [activeTab, normalizedQuery]);

  const resetFilters = () => {
    setQuery('');
    setActiveTab('all');
  };

  return (
    <div className="flex h-full min-h-screen bg-[#f8fafc] text-slate-800 dark:bg-[#0b0f17] dark:text-slate-100 overflow-hidden font-sans">
      {/* 1. LEFT SIDEBAR (宽 52，贴左排布，完全还原图2) */}
      <aside className="hidden w-52 flex-col border-r border-slate-200/80 bg-white p-3.5 dark:border-white/10 dark:bg-[#111622] md:flex shrink-0">
        {/* 顶部标题区 */}
        <div className="flex items-center gap-2.5 px-2 py-3 mb-2 border-b border-slate-100 dark:border-white/5">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-tr from-slate-900 to-slate-700 text-white font-black text-xs shadow-xs">
            AI
          </div>
          <div>
            <h2 className="text-xs font-black tracking-tight text-slate-900 dark:text-white">AI 视觉工作工坊</h2>
            <p className="text-[0.62rem] text-slate-400 font-bold">C端商业生成面板</p>
          </div>
        </div>

        {/* 侧边栏菜单列 */}
        <nav className="space-y-1 flex-1">
          <button
            type="button"
            onClick={() => setActiveSidebarItem('creation')}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
              activeSidebarItem === 'creation'
                ? 'bg-slate-100 text-slate-900 font-black dark:bg-slate-800 dark:text-white'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/50'
            }`}
          >
            <Wand2 className="h-4 w-4 text-orange-500" />
            <span>创作</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSidebarItem('assets')}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
              activeSidebarItem === 'assets'
                ? 'bg-slate-100 text-slate-900 font-black dark:bg-slate-800 dark:text-white'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/50'
            }`}
          >
            <Folder className="h-4 w-4 text-blue-500" />
            <span>资产</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSidebarItem('trending')}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
              activeSidebarItem === 'trending'
                ? 'bg-slate-100 text-slate-900 font-black dark:bg-slate-800 dark:text-white'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/50'
            }`}
          >
            <Flame className="h-4 w-4 text-red-500" />
            <span>爆款</span>
          </button>

          <div className="pt-3 pb-1">
            <span className="px-3 text-[0.62rem] font-bold text-slate-400 tracking-wider">常用与历史</span>
          </div>

          <button
            type="button"
            onClick={() => setActiveSidebarItem('recent')}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/50 transition"
          >
            <Clock className="h-4 w-4 text-slate-400" />
            <span>最近使用</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSidebarItem('tasks')}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/50 transition"
          >
            <ListTodo className="h-4 w-4 text-slate-400" />
            <span>任务中心</span>
          </button>

          <div className="pt-3 pb-1">
            <span className="px-3 text-[0.62rem] font-bold text-slate-400 tracking-wider">支持与服务</span>
          </div>

          <button
            type="button"
            onClick={() => setActiveSidebarItem('support')}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/50 transition"
          >
            <Headphones className="h-4 w-4 text-slate-400" />
            <span>联系客服</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSidebarItem('tutorials')}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/50 transition"
          >
            <BookOpen className="h-4 w-4 text-slate-400" />
            <span>使用教程</span>
          </button>
        </nav>

        {/* 底部用户极简信息区 */}
        <div className="rounded-xl border border-slate-200/70 bg-slate-50 p-2.5 dark:border-white/5 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[0.68rem] font-bold text-white dark:bg-white dark:text-slate-900">
              XC
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-slate-900 dark:text-white">商业用户</p>
              <p className="truncate text-[0.62rem] text-slate-400 font-medium">无限生成模式</p>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. RIGHT MAIN CONTENT AREA (取消全居中约束，全宽自适应与靠左对齐，解决“隔离太远”问题) */}
      <main className="flex-1 overflow-y-auto no-scrollbar min-w-0">
        {/* 顶部搜索栏与品类 Tabs 区域 (全宽，向左对齐) */}
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 px-6 py-4 backdrop-blur-md dark:border-white/10 dark:bg-[#0b0f17]/95 space-y-3.5">
          {/* 下拉 + 搜索框组合 */}
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
              >
                <span>智能体</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>
            </div>

            <div className="relative w-full max-w-md">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="输入模板关键词或功能名称，按 Enter 搜索"
                className="w-full rounded-xl border border-slate-200/90 bg-slate-50/80 py-2 pl-9 pr-8 text-xs font-medium text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/5 dark:border-white/10 dark:bg-slate-800/80 dark:text-white dark:focus:border-slate-500"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-700"
                >
                  清除
                </button>
              )}
            </div>
          </div>

          {/* 全品类 Tab 胶囊过滤栏 (完全对齐图2头部，靠左全展) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {PRODUCT_CATEGORY_TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`shrink-0 rounded-lg px-4 py-1.5 text-xs font-bold transition ${
                    active
                      ? 'bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-900'
                      : 'bg-slate-100/70 text-slate-600 hover:bg-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </header>

        {/* 内容分块区 (使用 w-full px-6，让卡片一排充满5列，完全对齐图2) */}
        <div className="w-full px-6 py-6 space-y-7">
          {filteredFeatures.length > 0 ? (
            FEATURE_CATEGORIES.map((cat) => {
              const groupFeatures = filteredFeatures.filter((f) => f.category === cat.id);
              if (groupFeatures.length === 0) return null;

              const sectionTitle =
                cat.id === 'core'
                  ? '主图/详情图/展示视频'
                  : cat.id === 'marketing'
                  ? '爆款复刻'
                  : cat.id === 'model'
                  ? '模特服装'
                  : '通用工具';

              return (
                <section key={cat.id} className="space-y-3">
                  {/* 分块 Header：对齐图2 `主图/详情图/展示视频 5个` */}
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm font-black text-slate-900 dark:text-white">
                      {sectionTitle}
                    </h2>
                    <span className="text-xs font-normal text-slate-400">
                      {groupFeatures.length}个
                    </span>
                  </div>

                  {/* 工具卡片 Grid (自适应 5 列布局，完全对齐图2卡片大小与排布) */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                    {groupFeatures.map((feature) => (
                      <FeatureCard
                        key={feature.mode}
                        feature={feature}
                        onOpen={() => onOpenFeature(feature.mode)}
                        badge={feature.mode === AppMode.UNIVERSAL_TRY_ON ? '+上新' : undefined}
                      />
                    ))}
                  </div>
                </section>
              );
            })
          ) : (
            <div className="flex min-h-[20rem] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 p-8 text-center dark:border-white/10">
              <Search className="h-8 w-8 text-slate-300 mb-3" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">未找到符合条件的功能</p>
              <p className="mt-1 text-xs text-slate-400">请尝试更换搜寻关键词或重置全品类筛选</p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                重置筛选
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default CreativeHub;
