import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Grid2X2, Menu, X } from 'lucide-react';
import CreativeHub from './components/CreativeHub';
import { CREATIVE_FEATURES, FEATURE_CATEGORIES, getFeatureByMode } from './featureRegistry';
import { AppMode } from './types';

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
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
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
    setVisitedModes((current) => {
      if (current.has(mode)) return current;
      const next = new Set(current);
      next.add(mode);
      return next;
    });
    setActiveMode(mode);
    setIsMobileSidebarOpen(false);
  };

  const openHub = () => {
    setActiveMode(null);
    setIsMobileSidebarOpen(false);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isMobileSidebarOpen) setIsMobileSidebarOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileSidebarOpen]);

  if (activeMode === null) {
    return <CreativeHub onOpenFeature={openFeature} onBack={handleBackToStudio} />;
  }

  return (
    <div className="relative flex h-screen overflow-hidden bg-[#f8fafc] text-slate-800 dark:bg-[#0b0f17] dark:text-slate-100">
      {isMobileSidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-sm lg:hidden"
          aria-label="关闭功能导航"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <aside
        onMouseEnter={() => setIsSidebarExpanded(true)}
        onMouseLeave={() => setIsSidebarExpanded(false)}
        onFocusCapture={() => setIsSidebarExpanded(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setIsSidebarExpanded(false);
          }
        }}
        className={`fixed inset-y-0 left-0 z-[80] flex w-[18rem] flex-col overflow-hidden border-r border-pastel-border bg-pastel-card shadow-2xl transition-[width,transform,box-shadow] duration-300 ease-out lg:absolute lg:z-40 lg:translate-x-0 ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${
          isSidebarExpanded
            ? 'lg:w-[17rem] lg:shadow-[8px_0_18px_rgba(50,35,25,0.07)] dark:lg:shadow-[8px_0_18px_rgba(0,0,0,0.2)]'
            : 'lg:w-[4.75rem] lg:shadow-none'
        }`}
        aria-label="创意中心功能导航"
      >
        <div className={`flex min-h-16 items-center justify-between border-b border-pastel-border px-3 transition-[padding] duration-300 ${isSidebarExpanded ? '' : 'lg:justify-center lg:px-2'}`}>
          <button
            type="button"
            onClick={openHub}
            className={`flex min-h-11 items-center gap-3 overflow-hidden rounded-xl px-3 text-sm font-black text-pastel-text transition-all duration-300 hover:bg-pastel-pink hover:text-pastel-highlight ${
              isSidebarExpanded ? 'w-full justify-start' : 'lg:w-11 lg:justify-center lg:px-0'
            }`}
            title="返回创意中心"
          >
            <Grid2X2 className="h-5 w-5 shrink-0 text-pastel-highlight" />
            <span className={`whitespace-nowrap transition-all duration-200 ${isSidebarExpanded ? 'lg:max-w-40 lg:opacity-100' : 'lg:max-w-0 lg:opacity-0'}`}>创意中心</span>
          </button>
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(false)}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-pastel-muted transition hover:bg-pastel-bg lg:hidden"
            aria-label="关闭导航"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="custom-scrollbar flex-1 overflow-x-hidden overflow-y-auto p-2.5">
          {FEATURE_CATEGORIES.map((category) => {
            const features = CREATIVE_FEATURES.filter((feature) => feature.category === category.id);
            return (
              <div key={category.id} className="mb-5 last:mb-0">
                <div
                  className={`mb-1.5 flex h-4 items-center px-3 text-[0.62rem] font-black tracking-[0.18em] text-pastel-muted transition-[padding] duration-300 ${
                    isSidebarExpanded ? '' : 'lg:justify-center lg:px-0'
                  }`}
                >
                  <span className={`whitespace-nowrap transition-all duration-200 ${isSidebarExpanded ? 'lg:max-w-40 lg:opacity-100' : 'lg:max-w-0 lg:opacity-0'}`}>{category.label}</span>
                  <span className={`hidden transition-opacity duration-200 lg:inline ${isSidebarExpanded ? 'opacity-0' : 'opacity-100'}`}>·</span>
                </div>
                <div className="space-y-1">
                  {features.map((feature) => {
                    const Icon = feature.icon;
                    const active = feature.mode === activeMode;
                    return (
                      <button
                        key={feature.mode}
                        type="button"
                        onClick={() => openFeature(feature.mode)}
                        className={`group flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-bold transition ${
                          active
                            ? 'bg-pastel-pink text-pastel-highlight shadow-sm'
                            : 'text-pastel-muted hover:bg-pastel-bg hover:text-pastel-text'
                        } ${isSidebarExpanded ? 'justify-start' : 'lg:justify-center lg:px-0'}`}
                        title={feature.title}
                        aria-current={active ? 'page' : undefined}
                      >
                        <Icon className="h-[1.15rem] w-[1.15rem] shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                        <span className={`whitespace-nowrap transition-all duration-200 ${isSidebarExpanded ? 'lg:max-w-48 lg:opacity-100' : 'lg:max-w-0 lg:overflow-hidden lg:opacity-0'}`}>{feature.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-pastel-border p-2.5">
          <button
            type="button"
            onClick={handleBackToStudio}
            className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-bold text-pastel-muted transition hover:bg-pastel-bg hover:text-pastel-highlight ${
              isSidebarExpanded ? 'justify-start' : 'lg:justify-center lg:px-0'
            }`}
            title="返回工作室"
          >
            <ChevronLeft className="h-5 w-5 shrink-0" />
            <span className={`whitespace-nowrap transition-all duration-200 ${isSidebarExpanded ? 'lg:max-w-40 lg:opacity-100' : 'lg:max-w-0 lg:overflow-hidden lg:opacity-0'}`}>返回工作室</span>
          </button>
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden lg:ml-[4.75rem]">
        <header className="flex min-h-16 shrink-0 items-center gap-3 border-b border-pastel-border bg-pastel-card/90 px-3 backdrop-blur-md sm:px-5">
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-pastel-border bg-pastel-card text-pastel-text transition hover:border-pastel-highlight hover:text-pastel-highlight lg:hidden"
            aria-label="打开功能导航"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={openHub}
            className="hidden min-h-11 items-center gap-1 text-sm font-bold text-pastel-muted transition hover:text-pastel-highlight sm:flex"
          >
            创意中心
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-black text-pastel-text sm:text-lg">{activeFeature?.title}</h1>
            <p className="hidden truncate text-xs text-pastel-muted md:block">{activeFeature?.description}</p>
          </div>
        </header>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          {CREATIVE_FEATURES.filter((feature) => visitedModes.has(feature.mode)).map((feature) => {
            const FeatureComponent = feature.component;
            const active = feature.mode === activeMode;
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
  );
};

export default App;
