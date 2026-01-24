import React, { useState, useEffect } from 'react';
import { AgentHome } from './components/AgentHome';
import { ChatStudio } from './components/ChatStudio';
import { SunIcon, MoonIcon } from './components/Icons';

type ViewState = 'home' | 'chat';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('home');
  const [initialData, setInitialData] = useState<{ text: string; images: string[]; model: string }>({ 
    text: '', 
    images: [],
    model: 'gemini-1.5-pro'
  });
  const [isDark, setIsDark] = useState(true);

  // Theme Initialization
  useEffect(() => {
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

  // Convert old single-image signature for AgentHome compatibility if needed, 
  // but better to update AgentHome to match.
  // Adapter for AgentHome if it passes (text, image, model)
  const handleStartAgentAdapter = (text: string, image: string | null, model: string) => {
      handleStartAgent(text, image ? [image] : [], model);
  };
  // But wait, AgentHome calls onStart with (text, image, model). 
  // I will update AgentHome as well to support passing *images* OR I handle the adapter inside App.
  // BUT the new Modal returns TWO images.
  // So I need a flexible `handleStartAgent` or overloading.
  // Let's make `handleStartAgent` robust.

  return (
    <div className="h-full bg-sky-light dark:bg-brand-dark text-gray-900 dark:text-white transition-colors duration-500 relative">
      {/* Theme Toggle Button - Fixed */}
      <button 
        onClick={toggleTheme}
        className="fixed top-6 right-6 z-50 p-2.5 rounded-full bg-white/50 dark:bg-white/10 backdrop-blur-md border border-gray-200 dark:border-white/10 shadow-lg hover:scale-105 transition-all text-gray-600 dark:text-yellow-400 hover:bg-white dark:hover:bg-white/20"
        aria-label="Toggle Theme"
      >
        {isDark ? <SunIcon /> : <MoonIcon />}
      </button>

      {view === 'home' ? (
        <AgentHome onStart={(text, img, model) => {
            // Check if 'img' is array (hack because I want to change interface)
            // Or just allow AgentHome to pass array?
            // Let's define the prop in App clearly.
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