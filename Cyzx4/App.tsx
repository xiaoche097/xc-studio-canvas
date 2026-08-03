import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import CreativeHub from './components/CreativeHub';
import { CREATIVE_FEATURES, getFeatureByMode } from './featureRegistry';
import { AppMode } from './types';
import GlobalSidebar, { type SidebarItem } from './components/GlobalSidebar';

interface CreativeCenterAppProps {
  onBack?: () => void;
}

const FeatureLoading: React.FC = () => (
  <div className="flex h-full min-h-[18rem] items-center justify-center bg-pastel-bg">
    <div className="flex items-center gap-3 rounded-2xl border border-pastel-border bg-pastel-card px-5 py-4 text-sm font-bold text-pastel-muted shadow-lg">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-pastel-highlight border-t-transparent" />
      正在加载创意工具…
    </div>
  </div>
);

const App: React.FC<CreativeCenterAppProps> = ({ onBack }) => {
  const [activeMode, setActiveMode] = useState<AppMode | null>(null);
  const [visitedModes, setVisitedModes] = useState<Set<AppMode>>(() => new Set());
  const [workspaceView, setWorkspaceView] = useState<'hub' | 'feature'>('hub');
  const [hubSidebarItem, setHubSidebarItem] = useState<SidebarItem>('creation');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const activeFeature = useMemo(() => getFeatureByMode(activeMode), [activeMode]);

  const handleBackToStudio = () => {
    if (onBack) {
      onBack();
      return;
    }
    window.location.href = '/';
  };

  const openFeature = (mode: AppMode) => {
    try {
      const stored = JSON.parse(localStorage.getItem('recent_features') || '[]');
      const filtered = stored.filter((m: string) => m !== mode);
      localStorage.setItem('recent_features', JSON.stringify([mode, ...filtered]));
    } catch {}

    setVisitedModes((current) => {
      if (current.has(mode)) return current;
      const next = new Set(current);
      next.add(mode);
      return next;
    });
    setActiveMode(mode);
    setWorkspaceView('feature');
    setIsMobileSidebarOpen(false);
  };

  const openHub = () => {
    setHubSidebarItem('creation');
    setWorkspaceView('hub');
    setIsMobileSidebarOpen(false);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isMobileSidebarOpen) setIsMobileSidebarOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileSidebarOpen]);

  const handleSidebarSelect = (item: SidebarItem) => {
    setHubSidebarItem(item);
    setWorkspaceView('hub');
  };

  return (
    <div className="relative h-screen overflow-hidden">
      <div
        className="h-full"
        style={{ display: workspaceView === 'hub' ? 'block' : 'none' }}
        aria-hidden={workspaceView !== 'hub'}
      >
        <CreativeHub
          activeSidebarItem={hubSidebarItem}
          onSelectSidebarItem={handleSidebarSelect}
          onOpenFeature={openFeature}
          onBack={handleBackToStudio}
        />
      </div>

      {activeMode !== null && (
        <div
          className="relative h-full"
          style={{ display: workspaceView === 'feature' ? 'block' : 'none' }}
          aria-hidden={workspaceView !== 'feature'}
        >
          <div className="relative flex h-full overflow-hidden bg-[#f8fafc] text-slate-800 dark:bg-[#0b0f17] dark:text-slate-100">
            {/* 功能工作区保持挂载；侧栏入口返回创意中心或相应管理页面。 */}
            <GlobalSidebar
              activeSidebarItem="creation"
              onSelectSidebarItem={handleSidebarSelect}
              onBack={handleBackToStudio}
            />

            <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
              {/* 顶部面包屑与功能 Header */}
              <header className="flex min-h-14 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/90 px-6 backdrop-blur-md dark:border-white/10 dark:bg-[#0b0f17]/90">
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={openHub}
                    className="font-bold text-slate-500 hover:text-slate-900 transition dark:text-slate-400 dark:hover:text-white"
                  >
                    创意中心
                  </button>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-black text-slate-900 dark:text-white">
                    {activeFeature?.title}
                  </span>
                </div>

                <div className="text-[0.7rem] font-bold text-slate-400">
                  {activeFeature?.description}
                </div>
              </header>

              <div className="relative min-h-0 flex-1 overflow-hidden">
                {CREATIVE_FEATURES.filter((feature) => visitedModes.has(feature.mode)).map((feature) => {
                  const FeatureComponent = feature.component;
                  const active = workspaceView === 'feature' && feature.mode === activeMode;
                  return (
                    <div
                      key={feature.mode}
                      className="h-full w-full"
                      style={{ display: active ? 'block' : 'none' }}
                      aria-hidden={!active}
                    >
                      <Suspense fallback={<FeatureLoading />}>
                        <FeatureComponent
                          isActive={active}
                          onImageGenerated={() => undefined}
                        />
                      </Suspense>
                    </div>
                  );
                })}
              </div>
            </main>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
