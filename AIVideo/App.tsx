import React, { useState } from 'react';
import StoryboardTab from './StoryboardTab';
import SettingsTab from './SettingsTab';
import { Clapperboard, ArrowLeft, Settings } from 'lucide-react';

type AIVideoMode = 'storyboard' | 'settings';

const AIVideoApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AIVideoMode>('storyboard');

  return (
    <div className="flex h-screen bg-pastel-bg text-pastel-text overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-20 md:w-64 bg-pastel-card border-r border-pastel-border flex flex-col flex-shrink-0 z-20 shadow-sm">
        <div className="h-16 flex items-center justify-center md:justify-start md:px-6 border-b border-pastel-border">
          <button
            onClick={() => window.location.href = '/'}
            className="bg-pastel-highlight text-white px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 shadow-sm hover:bg-orange-600 transition-colors w-10/12 md:w-auto justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden md:inline">Back to Studio</span>
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
          <div className="text-xs font-bold text-pastel-muted uppercase tracking-wider px-3 mb-2 hidden md:block">AI创意视频</div>

          <NavButton
            active={activeTab === 'storyboard'}
            onClick={() => setActiveTab('storyboard')}
            icon={<Clapperboard className="w-5 h-5" />}
            label="分镜创作"
          />

          <NavButton
            active={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
            icon={<Settings className="w-5 h-5" />}
            label="设置"
          />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-16 bg-pastel-card/80 backdrop-blur-md border-b border-pastel-border flex items-center px-6 justify-between flex-shrink-0">
          <h1 className="text-xl font-medium text-pastel-text">
            {activeTab === 'storyboard' && "分镜创作 (Storyboard)"}
            {activeTab === 'settings' && "设置 (Settings)"}
          </h1>
        </header>

        <div className="flex-1 overflow-auto p-0 relative">
          <div className="h-full w-full">
            <div style={{ display: activeTab === 'storyboard' ? 'block' : 'none', height: '100%' }}>
              <StoryboardTab />
            </div>
            <div style={{ display: activeTab === 'settings' ? 'block' : 'none', height: '100%' }}>
              <SettingsTab />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const NavButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group ${active
      ? 'bg-pastel-pink text-pastel-text shadow-sm font-medium'
      : 'text-pastel-muted hover:bg-pastel-bg hover:text-pastel-highlight'
      }`}
  >
    <div className={`${active ? 'text-pastel-text' : 'group-hover:text-pastel-highlight'} transition-colors`}>
      {icon}
    </div>
    <span className="hidden md:block font-medium text-sm">{label}</span>
  </button>
);

export default AIVideoApp;
