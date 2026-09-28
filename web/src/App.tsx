import React, { lazy, Suspense, useEffect, useState } from 'react';
import { AgentHome } from './components/AgentHome';
import { SunIcon, MoonIcon, SettingsIcon } from './components/Icons';
import { Bell, BookOpen, Cloud, History, Megaphone, X } from 'lucide-react';
import { gemini } from './lib/gemini';
import { SystemNoticeDialog } from './components/SystemNoticeDialog';
import { storageService } from './services/storageService';

const SparkChatStudio = lazy(() => import('./components/SparkChatStudio').then((module) => ({ default: module.SparkChatStudio })));
import { UnifiedSettingsModal } from './components/UnifiedSettingsModal';
const UnifiedSettingsPage = lazy(() => import('./components/UnifiedSettingsPage'));
const ProjectGalleryModal = lazy(() => import('./components/ProjectGalleryModal').then((module) => ({ default: module.ProjectGalleryModal })));
const VideoStationApp = lazy(() => import('./modules/XcAISTUDIO-main/App').then((module) => ({ default: module.App })));
const DollFactoryApp = lazy(() => import('./modules/DollFactory/App'));
const CreativeCenterApp = lazy(() => import('./modules/Cyzx4/App'));
const AIVideoApp = lazy(() => import('./modules/AIVideo/App'));
const YunwuApiStudio = lazy(() => import('./components/YunwuApiStudio'));
const ModelFactoryApp = lazy(() => import('./modules/ModelFactory/App'));

type ViewState = 'home' | 'chat' | 'video' | 'doll-factory' | 'creative' | 'ai-video' | 'yunwu' | 'model-factory' | 'settings';
type SystemNoticeTab = 'notice' | 'guide';

const getInitialView = (): ViewState => {
  if (typeof window === 'undefined') return 'home';

  const params = new URLSearchParams(window.location.search);
  if (params.get('view') === 'creative') return 'creative';
  if (params.get('view') === 'settings') return 'settings';
  return 'home';
};

const clearCreativeDeepLink = () => {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  url.searchParams.delete('view');
  url.searchParams.delete('tab');
  url.searchParams.delete('installed');
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
};

const LoadingScreen: React.FC<{ label?: string }> = ({ label = 'Loading workspace...' }) => (
  <div className="flex h-full w-full items-center justify-center bg-[#F8FAFC] dark:bg-[#050505]">
    <div className="rounded-2xl border border-gray-200 bg-white/80 px-6 py-5 text-sm font-medium text-gray-600 shadow-lg backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
      {label}
    </div>
  </div>
);

const SystemNoticeModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<SystemNoticeTab>('notice');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 px-4 py-8 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl overflow-hidden rounded-[1.6rem] border border-white/70 bg-[#eef4fc]/95 shadow-2xl shadow-slate-900/25 backdrop-blur-xl dark:border-white/10 dark:bg-[#151821]/95">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/70 via-transparent to-brand-orange/10 dark:from-white/5 dark:to-brand-orange/10" />

        <div className="relative flex items-start justify-between gap-4 px-6 py-5 md:px-8">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">系统通告</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">查看平台通知和功能使用说明。</p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="flex rounded-xl border border-gray-200 bg-white/75 p-1 shadow-sm dark:border-white/10 dark:bg-white/5">
              <button
                onClick={() => setActiveTab('notice')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold transition-all ${
                  activeTab === 'notice'
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-white/15 dark:text-white'
                    : 'text-gray-500 hover:text-brand-orange dark:text-gray-400'
                }`}
              >
                <Bell className="h-4 w-4" />
                通知
              </button>
              <button
                onClick={() => setActiveTab('guide')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold transition-all ${
                  activeTab === 'guide'
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-white/15 dark:text-white'
                    : 'text-gray-500 hover:text-brand-orange dark:text-gray-400'
                }`}
              >
                <BookOpen className="h-4 w-4" />
                使用说明
              </button>
            </div>

            <button
              onClick={onClose}
              className="rounded-full p-2 text-gray-500 transition-all hover:bg-white/80 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="关闭系统通告"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="relative max-h-[68vh] overflow-y-auto px-6 pb-8 md:px-8">
          {activeTab === 'notice' ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-brand-orange/30 bg-orange-50/90 px-5 py-4 text-center text-brand-orange shadow-sm dark:bg-brand-orange/10">
                <div className="font-black">通知内容待添加</div>
                <p className="mt-1 text-sm font-medium text-orange-700/80 dark:text-orange-100/80">
                  这里后续放平台公告、版本更新、活动提醒等内容。
                </p>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center gap-2 text-base font-black text-gray-900 dark:text-white">
                  <Megaphone className="h-5 w-5 text-brand-orange" />
                  最新通知
                </div>
                <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50/80 p-6 text-center text-sm text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
                  暂无通知内容
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-100 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
              <div className="flex items-center gap-2 text-base font-black text-gray-900 dark:text-white">
                <BookOpen className="h-5 w-5 text-brand-orange" />
                使用说明
              </div>
              <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50/80 p-6 text-center text-sm text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
                使用说明内容待添加
              </div>
            </div>
          )}
        </div>

        <div className="relative flex justify-end gap-3 border-t border-white/60 px-6 py-4 dark:border-white/10 md:px-8">
          <button
            onClick={onClose}
            className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-brand-orange shadow-sm transition-all hover:bg-orange-50 dark:bg-white/10 dark:hover:bg-white/15"
          >
            关闭公告
          </button>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(getInitialView);
  const [initialData, setInitialData] = useState<{ text: string; images: string[]; model: string; step?: number }>({
    text: '',
    images: [],
    model: 'gpt-5.6-luna'
  });
  const [isDark, setIsDark] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isSystemNoticeOpen, setIsSystemNoticeOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Theme Initialization
  useEffect(() => {
    setMounted(true);
    storageService.startAutoExpirationCleanup();
    // Check localStorage or system preference
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme === 'light') {
      setIsDark(false);
      document.documentElement.classList.remove('dark');
    }

    // Listen for History Open Event
    const handleOpenHistory = () => setIsGalleryOpen(true);
    
    const handleApiUpdate = () => {
      const stored = localStorage.getItem('user_gemini_api_key');
      if (stored) gemini.updateApiKey(stored);
    };

    const handleOpenSettings = () => setView('settings');

    window.addEventListener('open-history', handleOpenHistory);
    window.addEventListener('api-settings-updated', handleApiUpdate);
    window.addEventListener('open-settings', handleOpenSettings);

    return () => {
      storageService.stopAutoExpirationCleanup();
      window.removeEventListener('open-history', handleOpenHistory);
      window.removeEventListener('api-settings-updated', handleApiUpdate);
      window.removeEventListener('open-settings', handleOpenSettings);
    };
  }, []);

  useEffect(() => {
    const syncDeepLinkedView = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'creative') setView('creative');
      if (params.get('view') === 'settings') setView('settings');
    };

    window.addEventListener('popstate', syncDeepLinkedView);
    return () => window.removeEventListener('popstate', syncDeepLinkedView);
  }, []);

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    if (newDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleStartAgent = (text: string, images: string[], model: string, step?: number) => {
    setInitialData({ text, images, model, step });
    setView('chat');
  };

  const handleBackToHome = () => {
    setInitialData({ text: '', images: [], model: 'gemini-3-pro-preview' });
    setView('home');
  };

  const handleExitCreativeCenter = () => {
    clearCreativeDeepLink();
    setView('home');
  };

  const renderActiveView = () => {
    if (view === 'yunwu') {
      return (
        <div className="relative w-full h-full z-[100] overflow-hidden">
          <YunwuApiStudio onBack={() => setView('home')} />
        </div>
      );
    }

    if (view === 'video') {
      return (
        <div className="relative w-full h-full bg-black z-[100]">
          <VideoStationApp />
          <button
            onClick={() => setView('home')}
            className="fixed top-4 left-4 z-[9999] px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-lg hover:bg-white/20 transition-all font-medium text-sm flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            Back to Studio
          </button>
        </div>
      );
    }

    if (view === 'doll-factory') {
      return (
        <div className="relative w-full h-full bg-[#f0f7ff] dark:bg-[#050505] z-[100]">
          <DollFactoryApp />
        </div>
      );
    }

    if (view === 'ai-video') {
      return (
        <div className="relative w-full h-full bg-[#f0f7ff] dark:bg-[#050505] z-[100]">
          <AIVideoApp />
        </div>
      );
    }

    if (view === 'model-factory') {
      return (
        <div className="relative w-full h-full bg-[#f0f7ff] dark:bg-[#050505] z-[100]">
          <ModelFactoryApp />
        </div>
      );
    }

    if (view === 'creative') {
      return (
        <div className="relative w-full h-full bg-[#f0f7ff] dark:bg-[#050505] z-[100]">
          <CreativeCenterApp onBack={handleExitCreativeCenter} />
        </div>
      );
    }

    if (view === 'settings') {
      return (
        <div className="relative w-full h-full bg-[#F8FAFC] dark:bg-[#07090E] z-[100] overflow-hidden">
          <UnifiedSettingsPage onBack={() => setView('home')} />
        </div>
      );
    }

    if (view === 'home') {
      return (
        <AgentHome 
          onOpenSettings={() => setView('settings')}
          onStart={(text, img, model, step) => {
            if (step === 12) {
              setView('video');
            } else if (step === 14 || step === 17) {
              setView('doll-factory');
            } else if (step === 15) {
              setView('ai-video');
            } else if (step === 16) {
              setView('model-factory');
            } else if (text.startsWith('/creative')) {
              setView('creative');
            } else if (Array.isArray(img)) {
              handleStartAgent(text, img, model, step);
            } else {
              handleStartAgent(text, img ? [img] : [], model, step);
            }
          }} 
        />
      );
    }

    return (
      <SparkChatStudio
        initialInput={initialData.text}
        initialImages={initialData.images}
        initialModel={initialData.model}
        onBack={handleBackToHome}
      />
    );
  };

  if (!mounted) return null;

  return (
    <div className="h-screen w-full overflow-hidden bg-sky-light dark:bg-brand-dark text-gray-900 dark:text-white transition-colors duration-500 relative">
      {/* Top Right Controls (Hidden in Chat, Creative, Settings and Home views) */}
      {view !== 'chat' && view !== 'creative' && view !== 'settings' && view !== 'home' && (
        <div className="fixed top-6 right-6 z-50 flex gap-2">
          <button
            onClick={() => setIsSystemNoticeOpen(true)}
            className="p-2.5 rounded-full bg-gradient-to-r from-brand-orange/85 to-orange-500/85 backdrop-blur-md border border-orange-300/30 dark:border-orange-500/30 shadow-lg hover:scale-105 transition-all text-white hover:shadow-orange-500/30 group"
            aria-label="System notice"
            title="系统通告"
          >
            <Megaphone className="w-5 h-5" />
          </button>
          {/* Yunwu API Button - 品牌橙色调 */}
          <button
            onClick={() => setView('yunwu')}
            className="p-2.5 rounded-full bg-white/50 dark:bg-white/10 backdrop-blur-md border border-gray-200 dark:border-white/10 shadow-lg hover:scale-105 transition-all text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-white/20 hover:text-brand-orange dark:hover:text-brand-orange group"
            aria-label="Yunwu API"
            title="云雾API Studio"
          >
            <Cloud className="w-5 h-5" />
          </button>

          {/* History Button */}
          <button
            onClick={() => setIsGalleryOpen(true)}
            className="p-2.5 rounded-full bg-white/50 dark:bg-white/10 backdrop-blur-md border border-gray-200 dark:border-white/10 shadow-lg hover:scale-105 transition-all text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-white/20 hover:text-brand-orange dark:hover:text-brand-orange group"
            aria-label="History"
          >
            <History className="w-5 h-5" />
          </button>

          {/* Settings Button - Navigates directly to full Settings Page */}
          <button
            onClick={() => {
              setView('settings');
            }}
            className="p-2.5 rounded-full bg-white/50 dark:bg-white/10 backdrop-blur-md border border-gray-200 dark:border-white/10 shadow-lg hover:scale-105 transition-all text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-white/20 hover:text-brand-orange dark:hover:text-brand-orange group"
            title="模型与协议设置"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-full bg-white/50 dark:bg-white/10 backdrop-blur-md border border-gray-200 dark:border-white/10 shadow-lg hover:scale-105 transition-all text-gray-600 dark:text-yellow-400 hover:bg-white dark:hover:bg-white/20"
            aria-label="Toggle Theme"
          >
            {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
          </button>
        </div>
      )}

      <Suspense fallback={<LoadingScreen />}>
        <SystemNoticeDialog isOpen={isSystemNoticeOpen} onClose={() => setIsSystemNoticeOpen(false)} />
        {isSettingsOpen && <UnifiedSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />}
        {isGalleryOpen && <ProjectGalleryModal isOpen={isGalleryOpen} onClose={() => setIsGalleryOpen(false)} />}
        {renderActiveView()}
      </Suspense>
    </div>
  );
};

export default App;
