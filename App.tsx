import React, { useState, useEffect } from 'react';
import { AgentHome } from './components/AgentHome';
import { ChatStudio } from './components/ChatStudio';
import { SunIcon, MoonIcon, SettingsIcon } from './components/Icons';
import { SettingsModal } from './components/SettingsModal';
import { ProjectGalleryModal } from './components/ProjectGalleryModal';
import { History } from 'lucide-react';

import { App as VideoStationApp } from './XcAISTUDIO-main/App';
import AmazonSelectionApp from './amazonxpzj/App';
import CreativeCenterApp from './Cyzx4/App';

type ViewState = 'home' | 'chat' | 'video' | 'selection' | 'creative';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('home');
  const [initialData, setInitialData] = useState<{ text: string; images: string[]; model: string; step?: number }>({
    text: '',
    images: [],
    model: 'gemini-3-pro-preview'
  });
  const [isDark, setIsDark] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Theme Initialization
  useEffect(() => {
    setMounted(true);
    // ... same code ...
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

  if (!mounted) return null;

  return (
    <div className="h-full bg-sky-light dark:bg-brand-dark text-gray-900 dark:text-white transition-colors duration-500 relative">
      {/* Top Right Controls */}
      <div className="fixed top-6 right-6 z-50 flex gap-2">
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
          onClick={() => setIsSettingsOpen(true)}
          className="p-2.5 rounded-full bg-white/50 dark:bg-white/10 backdrop-blur-md border border-gray-200 dark:border-white/10 shadow-lg hover:scale-105 transition-all text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-white/20"
          aria-label="Settings"
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


      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <ProjectGalleryModal isOpen={isGalleryOpen} onClose={() => setIsGalleryOpen(false)} />

      {view === 'video' ? (
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
      ) : view === 'selection' ? (
        <div className="relative w-full h-full bg-[#F8FAFC] dark:bg-[#050505] z-[100] overflow-y-auto">
          {/* Use Amazon Selection App - No Back button here, handled inside AmazonSelectionApp */}
          <AmazonSelectionApp />
        </div>
      ) : view === 'creative' ? (
        <div className="relative w-full h-full bg-[#f0f7ff] dark:bg-[#050505] z-[100]">
          {/* Back Button Overlay */}
          <button
            onClick={() => setView('home')}
            className="fixed bottom-4 left-4 z-[9999] px-4 py-2 bg-brand-orange text-white rounded-full shadow-lg hover:scale-105 transition-all font-bold text-xs flex items-center gap-2"
          >
            ← Back to Studio
          </button>
          <CreativeCenterApp />
        </div>
      ) : view === 'home' ? (
        <AgentHome onStart={(text, img, model, step) => {
          if (step === 12) { // WorkflowStep.VIDEO_GENERATION
            setView('video');
          } else if (step === 14) { // WorkflowStep.AMAZON_SELECTION
            setView('selection');
          } else if (text.startsWith('/creative')) {
            setView('creative');
          } else {
            if (Array.isArray(img)) {
              handleStartAgent(text, img, model, step);
            } else {
              handleStartAgent(text, img ? [img] : [], model, step);
            }
          }
        }} />
      ) : (
        <ChatStudio
          initialInput={initialData.text}
          initialImages={initialData.images}
          initialModel={initialData.model}
          initialStep={initialData.step}
          onBack={handleBackToHome}
        />
      )}
    </div>
  );
};

export default App;