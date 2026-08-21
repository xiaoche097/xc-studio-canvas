import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  ArrowLeft,
  X,
} from 'lucide-react';
import {
  CREATIVE_FEATURES,
  FEATURE_CATEGORIES,
  type CreativeFeature,
  type FeatureCategory,
} from '../featureRegistry';
import { AppMode } from '../types';
import AssetsManager from './AssetsManager';
import RecentUsedManager from './RecentUsedManager';
import TaskCenterManager from './TaskCenterManager';
import GlobalSidebar, { type SidebarItem } from './GlobalSidebar';
import Home, { type WorkspaceSeed } from '../pages/Home';
import CanvasStudioManager from './CanvasStudioManager';

type CategoryFilter = 'all' | 'fashion' | 'video' | 'architecture' | 'food' | 'utility';

interface CreativeHubProps {
  activeSidebarItem: SidebarItem;
  onSelectSidebarItem: (item: SidebarItem) => void;
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

const SEARCH_HISTORY_KEY = 'creative_hub_search_history';
const SEARCH_SUGGESTIONS = [
  '主图',
  '详情页',
  '视频',
  '白底图',
  '穿搭',
  '换背景',
  '模特',
  '文案',
  '产品替换',
  '换脸',
  '场景图',
  '高清放大',
];

const FeatureCard: React.FC<{
  feature: CreativeFeature;
  onOpen: () => void;
  badge?: string;
}> = ({ feature, onOpen, badge }) => {
  return (
    <div
      onClick={onOpen}
      className="group cursor-pointer overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-xs transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-slate-300/90 hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-slate-900 dark:hover:shadow-[0_14px_30px_rgba(0,0,0,0.4)]"
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
        <h3 className="text-base font-black text-slate-900 dark:text-slate-100 group-hover:text-orange-600 transition-colors">
          {feature.title}
        </h3>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400 font-medium">
          {feature.description}
        </p>
      </div>
    </div>
  );
};

const CreativeHub: React.FC<CreativeHubProps> = ({
  activeSidebarItem,
  onSelectSidebarItem,
  onOpenFeature,
  onBack,
}) => {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<CategoryFilter>('all');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [suggestionOffset, setSuggestionOffset] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [workspaceSeed, setWorkspaceSeed] = useState<WorkspaceSeed | null>(null);
  const [sidebarCollapseRequest, setSidebarCollapseRequest] = useState(0);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  const normalizedQuery = normalizeSearch(query);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]');
      if (Array.isArray(stored)) {
        setRecentSearches(stored.filter((item): item is string => typeof item === 'string').slice(0, 6));
      }
    } catch {}
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!searchBoxRef.current?.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const visibleSuggestions = useMemo(() => {
    if (normalizedQuery) {
      return CREATIVE_FEATURES.filter((feature) => {
        const searchable = [feature.title, feature.englishTitle, ...feature.keywords]
          .join(' ')
          .toLocaleLowerCase('zh-CN');
        return searchable.includes(normalizedQuery);
      })
        .map((feature) => feature.title)
        .slice(0, 8);
    }

    return Array.from(
      { length: 8 },
      (_, index) => SEARCH_SUGGESTIONS[(suggestionOffset + index) % SEARCH_SUGGESTIONS.length],
    );
  }, [normalizedQuery, suggestionOffset]);

  const commitSearch = (value: string) => {
    const nextQuery = value.trim();
    setQuery(nextQuery);
    setIsSearchOpen(false);
    if (!nextQuery) return;

    setRecentSearches((current) => {
      const next = [nextQuery, ...current.filter((item) => item !== nextQuery)].slice(0, 6);
      try {
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch {}
  };

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

  const handleOpenFeatureWithRecord = (mode: AppMode) => {
    try {
      const stored = JSON.parse(localStorage.getItem('recent_features') || '[]');
      const filtered = stored.filter((m: string) => m !== mode);
      localStorage.setItem('recent_features', JSON.stringify([mode, ...filtered]));
    } catch {}
    onOpenFeature(mode);
  };

  const handleStartWorkspace = (seed: WorkspaceSeed) => {
    setWorkspaceSeed(seed);
    onSelectSidebarItem('canvas');
  };

  return (
    <div className="flex h-full min-h-screen bg-[#f8fafc] text-slate-800 dark:bg-[#0b0f17] dark:text-slate-100 overflow-hidden font-sans">
      {/* 1. LEFT SIDEBAR (在进入画布模式时隐藏全局侧边栏) */}
      {activeSidebarItem !== 'canvas' && (
        <GlobalSidebar
          activeSidebarItem={activeSidebarItem}
          onSelectSidebarItem={onSelectSidebarItem}
          onBack={onBack}
          collapseRequest={sidebarCollapseRequest}
        />
      )}

      {/* 2. RIGHT MAIN CONTENT AREA */}
      {activeSidebarItem === 'home' ? (
        <div className="flex-1 overflow-hidden min-w-0">
          <Home
            onStartWorkspace={handleStartWorkspace}
            onOpenFeature={handleOpenFeatureWithRecord}
            onAgentEngage={() =>
              setSidebarCollapseRequest((request) => request + 1)
            }
          />
        </div>
      ) : activeSidebarItem === 'canvas' ? (
        <div className="flex-1 overflow-hidden min-w-0">
          <CanvasStudioManager
            initialPrompt={workspaceSeed?.prompt}
            initialAttachments={workspaceSeed?.attachments}
            onBackToHub={() => onSelectSidebarItem('home')}
          />
        </div>
      ) : activeSidebarItem === 'assets' ? (
        <div className="flex-1 overflow-hidden min-w-0">
          <AssetsManager />
        </div>
      ) : activeSidebarItem === 'recent' ? (
        <div className="flex-1 overflow-hidden min-w-0">
          <RecentUsedManager
            onOpenFeature={handleOpenFeatureWithRecord}
            onSwitchToCreation={() => onSelectSidebarItem('creation')}
          />
        </div>
      ) : (
        <main className="flex-1 overflow-y-auto no-scrollbar min-w-0">
        {/* 顶部搜索栏与品类 Tabs 区域 (全宽，向左对齐) */}
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 px-6 py-4 backdrop-blur-md dark:border-white/10 dark:bg-[#0b0f17]/95 space-y-3.5">
          {/* 搜索范围 + 搜索框 + 推荐面板 */}
          <div ref={searchBoxRef} className="relative w-full max-w-[640px]">
            <div
              className={`flex h-11 items-stretch overflow-hidden rounded-xl border bg-white shadow-2xs transition-all dark:bg-slate-900 ${
                isSearchOpen
                  ? 'border-slate-400 ring-4 ring-slate-900/[0.04] dark:border-slate-500 dark:ring-white/[0.04]'
                  : 'border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20'
              }`}
            >
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="flex w-[92px] shrink-0 items-center justify-center gap-1.5 border-r border-slate-200 bg-slate-50/70 px-3 text-sm font-bold text-slate-800 transition hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800/70 dark:text-slate-100 dark:hover:bg-slate-800"
                aria-label="当前搜索范围：智能体"
              >
                <span>智能体</span>
                <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${isSearchOpen ? 'rotate-180' : ''}`} />
              </button>

              <div className="relative min-w-0 flex-1">
              <Search className={`pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors ${isSearchOpen ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`} />
              <input
                type="text"
                value={query}
                onFocus={() => setIsSearchOpen(true)}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitSearch(query);
                  if (event.key === 'Escape') setIsSearchOpen(false);
                }}
                placeholder="输入模板关键词或功能名称，按 Enter 搜索"
                className="h-full w-full bg-transparent pl-10 pr-10 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
                role="combobox"
                aria-expanded={isSearchOpen}
                aria-controls="creative-search-panel"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setIsSearchOpen(true);
                  }}
                  className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  aria-label="清除搜索内容"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              </div>
            </div>

            {isSearchOpen && (
              <div
                id="creative-search-panel"
                className="absolute inset-x-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.13)] dark:border-white/10 dark:bg-slate-900 dark:shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
                role="listbox"
              >
                <div className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      {normalizedQuery ? '相关功能' : '猜你想搜'}
                    </span>
                    {!normalizedQuery && (
                      <button
                        type="button"
                        onClick={() => setSuggestionOffset((current) => (current + 8) % SEARCH_SUGGESTIONS.length)}
                        className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      >
                        <RotateCcw className="h-3 w-3" />
                        换一换
                      </button>
                    )}
                  </div>

                  {visibleSuggestions.length > 0 ? (
                    <div className="grid grid-cols-2 gap-x-8 gap-y-0.5">
                      {visibleSuggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => commitSearch(suggestion)}
                          className="truncate rounded-lg px-2.5 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-orange-50 hover:text-orange-700 dark:text-slate-300 dark:hover:bg-orange-500/10 dark:hover:text-orange-300"
                          role="option"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-xs text-slate-400 dark:bg-slate-800/60">
                      暂无匹配建议，按 Enter 搜索全部内容
                    </p>
                  )}
                </div>

                {recentSearches.length > 0 && (
                  <div className="border-t border-slate-100 px-4 py-3.5 dark:border-white/10">
                    <div className="mb-2.5 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">最近搜索</span>
                      <button
                        type="button"
                        onClick={clearRecentSearches}
                        className="rounded-md px-1.5 py-1 text-xs font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      >
                        清空
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {recentSearches.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => commitSearch(item)}
                          className="flex max-w-[10rem] items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
                        >
                          <Clock className="h-3 w-3 shrink-0 text-slate-400" />
                          <span className="truncate">{item}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
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
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                      {sectionTitle}
                    </h2>
                    <span className="text-xs font-bold text-slate-400">
                      {groupFeatures.length}个
                    </span>
                  </div>

                  {/* 工具卡片 Grid (自适应 5 列布局，完全对齐图2卡片大小与排布) */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                    {groupFeatures.map((feature) => (
                      <FeatureCard
                        key={feature.mode}
                        feature={feature}
                        onOpen={() => handleOpenFeatureWithRecord(feature.mode)}
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
      )}

      {/* 任务中心全局半透明蒙层 Modal 弹窗 */}
      {activeSidebarItem === 'tasks' && (
        <TaskCenterManager onClose={() => onSelectSidebarItem('creation')} />
      )}
    </div>
  );
};

export default CreativeHub;
