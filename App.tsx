import React, { useState, useEffect } from 'react';
import { AgentHome } from './components/AgentHome';
import { ChatStudio } from './components/ChatStudio';
import { SunIcon, MoonIcon, SettingsIcon } from './components/Icons';
import { SettingsModal } from './components/SettingsModal';

type ViewState = 'home' | 'chat';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('home');
  const [initialData, setInitialData] = useState<{ text: string; images: string[]; model: string }>({ 
    text: '', 
    images: [],
    model: 'gemini-1.5-pro'
  });
  const [isDark, setIsDark] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
    } else {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
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

  const handleStartAgent = (text: string, images: string[], model: string) => {
    setInitialData({ text, images, model });
    setView('chat');
  };

  const handleBackToHome = () => {
    setInitialData({ text: '', images: [], model: 'gemini-1.5-pro' });
    setView('home');
  };

  if (!mounted) return null;

  return (
    <div className="h-full bg-sky-light dark:bg-brand-dark text-gray-900 dark:text-white transition-colors duration-500 relative">
      {/* Top Right Controls */}
      <div className="fixed top-6 right-6 z-50 flex gap-2">
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

      {view === 'home' ? (
        <AgentHome onStart={(text, img, model) => {
            if (Array.isArray(img)) {
                 handleStartAgent(text, img, model);
            } else {
                 handleStartAgent(text, img ? [img] : [], model);
            }
        }} />
      ) : (
        <ChatStudio 
          initialInput={initialData.text} 
          initialImages={initialData.images} 
          initialModel={initialData.model}
          onBack={handleBackToHome}
        />
      )}
    </div>
  );
};

export default App;