import React, { lazy, Suspense, useEffect, useState } from 'react';
import { AgentHome } from './components/AgentHome';
import { SunIcon, MoonIcon, SettingsIcon } from './components/Icons';
import { History, Cloud } from 'lucide-react';

const ChatStudio = lazy(() => import('./components/ChatStudio').then((module) => ({ default: module.ChatStudio })));
const SettingsModal = lazy(() => import('./components/SettingsModal').then((module) => ({ default: module.SettingsModal })));
const ProjectGalleryModal = lazy(() => import('./components/ProjectGalleryModal').then((module) => ({ default: module.ProjectGalleryModal })));
const VideoStationApp = lazy(() => import('./XcAISTUDIO-main/App').then((module) => ({ default: module.App })));
const DollFactoryApp = lazy(() => import('./DollFactory/App'));
const CreativeCenterApp = lazy(() => import('./Cyzx4/App'));
const AIVideoApp = lazy(() => import('./AIVideo/App'));
const YunwuApiStudio = lazy(() => import('./components/YunwuApiStudio'));
const ModelFactoryApp = lazy(() => import('./ModelFactory/App'));

type ViewState = 'home' | 'chat' | 'video' | 'doll-factory' | 'creative' | 'ai-video' | 'yunwu' | 'model-factory';

const LoadingScreen: React.FC<{ label?: string }> = ({ label = 'Loading workspace...' }) => (
  <div className="flex h-full w-full items-center justify-center bg-[#F8FAFC] dark:bg-[#050505]">
    <div className="rounded-2xl border border-gray-200 bg-white/80 px-6 py-5 text-sm font-medium text-gray-600 shadow-lg backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
      {label}
    </div>
  </div>
);

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('home');
  const [initialData, setInitialData] = useState<{ text: string; images: string[]; model: string; step?: number }>({
    text: '',
    images: [],
    model: 'gemini-3-pro-preview'
  });
  const [isDark, setIsDark] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'api' | 'agent'>('api');
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Theme Initialization
  useEffect(() => {
    setMounted(true);
    // Check localStorage or system preference
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'light') {
      setIsDark(false);
      document.documentElement.classList.remove('dark');
    }

    // Listen for History Open Event
    const handleOpenHistory = () => setIsGalleryOpen(true);
    window.addEventListener('open-history', handleOpenHistory);
    return () => window.removeEventListener('open-history', handleOpenHistory);
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
          <CreativeCenterApp />
        </div>
      );
    }

    if (view === 'home') {
      return (
        <AgentHome 
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
          onOpenSettings={(tab) => {
            setSettingsTab(tab);
            setIsSettingsOpen(true);
          }}
        />
      );
    }

    return (
      <ChatStudio
        initialInput={initialData.text}
        initialImages={initialData.images}
        initialModel={initialData.model}
        initialStep={initialData.step}
        onBack={handleBackToHome}
      />
    );
  };

  if (!mounted) return null;

  return (
    <div className="h-screen w-full overflow-hidden bg-sky-light dark:bg-brand-dark text-gray-900 dark:text-white transition-colors duration-500 relative">
      {/* Top Right Controls */}
      <div className="fixed top-6 right-6 z-50 flex gap-2">
        {/* Yunwu API Button - 品牌橙色调 */}
        <button
          onClick={() => setView('yunwu')}
          className="p-2.5 rounded-full bg-gradient-to-r from-brand-orange/80 to-orange-500/80 backdrop-blur-md border border-orange-300/30 dark:border-orange-500/30 shadow-lg hover:scale-105 transition-all text-white hover:shadow-orange-500/30 group"
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

        {/* Settings Button */}
        <button
          onClick={() => {
            setSettingsTab('api');
            setIsSettingsOpen(true);
          }}
          className="p-2.5 rounded-full bg-white/50 dark:bg-white/10 backdrop-blur-md border border-gray-200 dark:border-white/10 shadow-lg hover:scale-105 transition-all text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-white/20 hover:text-brand-orange dark:hover:text-brand-orange group"
          title="设置"
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

      <Suspense fallback={null}>
        {isSettingsOpen && (
          <SettingsModal 
            isOpen={isSettingsOpen} 
            onClose={() => setIsSettingsOpen(false)} 
            initialTab={settingsTab}
          />
        )}
        {isGalleryOpen && (
          <ProjectGalleryModal isOpen={isGalleryOpen} onClose={() => setIsGalleryOpen(false)} />
        )}
        {renderActiveView()}
      </Suspense>
    </div>
  );
};

export default App;
