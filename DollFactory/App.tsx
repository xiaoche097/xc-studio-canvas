import React, { useState } from 'react';
import DollMainAdjustTab from './DollMainAdjustTab';
import DollMainRetouchTab from './DollMainRetouchTab';
import DollDesignOptimizeTab from './DollDesignOptimizeTab';
import DollAnglePresetsTab from './DollAnglePresetsTab';
import DollAngleReferenceTab from './DollAngleReferenceTab';
import DollBatchRetouchTab from './DollBatchRetouchTab';
import { ArrowLeft, UserCircle2, Sparkles, Wand2, Camera, Zap } from 'lucide-react';

type DollFactoryMode = 'main-adjust' | 'main-retouch' | 'batch-retouch' | 'design-optimize' | 'angle-presets' | 'angle-reference';

const DollFactoryApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DollFactoryMode>('main-adjust');

  return (
    <div className="flex h-screen bg-pastel-bg text-pastel-text overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-20 md:w-64 bg-pastel-card border-r border-pastel-border flex flex-col flex-shrink-0 z-20 shadow-sm transition-colors">
        <div className="h-16 flex items-center justify-center md:justify-start md:px-6 border-b border-pastel-border">
          <button
            onClick={() => window.location.href = '/'}
            className="bg-pastel-highlight text-white px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 shadow-sm hover:bg-orange-600 transition-colors w-10/12 md:w-auto justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden md:inline">Back to Studio</span>
          </button>
        </div>

        <nav className="flex-1 p-4 flex flex-col overflow-y-auto custom-scrollbar">
          <div className="text-xs font-bold text-pastel-muted uppercase tracking-wider px-3 mb-2 hidden md:block">精修工作台</div>
          
          <div className="space-y-2 flex-1">
            <NavButton
              active={activeTab === 'main-adjust'}
              onClick={() => setActiveTab('main-adjust')}
              icon={<UserCircle2 className="w-5 h-5" />}
              label="主图精修工具"
            />
            <NavButton
              active={activeTab === 'main-retouch'}
              onClick={() => setActiveTab('main-retouch')}
              icon={<Sparkles className="w-5 h-5" />}
              label="参考图精修"
            />
            <NavButton
              active={activeTab === 'batch-retouch'}
              onClick={() => setActiveTab('batch-retouch')}
              icon={<Zap className="w-5 h-5" />}
              label="批量精修"
            />
            <NavButton
              active={activeTab === 'design-optimize'}
              onClick={() => setActiveTab('design-optimize')}
              icon={<Wand2 className="w-5 h-5" />}
              label="玩偶设计优化"
            />
            <NavButton
              active={activeTab === 'angle-reference'}
              onClick={() => setActiveTab('angle-reference')}
              icon={<Sparkles className="w-5 h-5" />}
              label="角度参考"
            />
            <NavButton
              active={activeTab === 'angle-presets'}
              onClick={() => setActiveTab('angle-presets')}
              icon={<Camera className="w-5 h-5" />}
              label="可爱角度转变"
            />
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-16 bg-pastel-card/80 backdrop-blur-md border-b border-pastel-border flex items-center px-6 justify-between flex-shrink-0">
          <h1 className="text-xl font-medium text-pastel-text">
            {activeTab === 'main-adjust' && "主图精修工具"}
            {activeTab === 'main-retouch' && "参考图精修"}
            {activeTab === 'batch-retouch' && "批量精修"}
            {activeTab === 'design-optimize' && "玩偶设计优化"}
            {activeTab === 'angle-reference' && "角度参考"}
            {activeTab === 'angle-presets' && "可爱角度转变"}
          </h1>
        </header>

        <div className="flex-1 overflow-auto p-0 relative">
          <div className="h-full w-full">
            <div style={{ display: activeTab === 'main-adjust' ? 'block' : 'none', height: '100%' }}>
              <DollMainAdjustTab />
            </div>
            <div style={{ display: activeTab === 'main-retouch' ? 'block' : 'none', height: '100%' }}>
              <DollMainRetouchTab />
            </div>
            <div style={{ display: activeTab === 'batch-retouch' ? 'block' : 'none', height: '100%' }}>
              <DollBatchRetouchTab />
            </div>
            <div style={{ display: activeTab === 'design-optimize' ? 'block' : 'none', height: '100%' }}>
              <DollDesignOptimizeTab />
            </div>
            <div style={{ display: activeTab === 'angle-reference' ? 'block' : 'none', height: '100%' }}>
              <DollAngleReferenceTab />
            </div>
            <div style={{ display: activeTab === 'angle-presets' ? 'block' : 'none', height: '100%' }}>
              <DollAnglePresetsTab />
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
    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group ${
      active
        ? 'bg-pastel-pink text-pastel-text shadow-sm font-medium'
        : 'text-pastel-muted hover:bg-pastel-bg hover:text-pastel-highlight'
    }`}
  >
    <div className={`${active ? 'text-pastel-text' : 'group-hover:text-pastel-highlight'} transition-colors`}>
      {icon}
    </div>
    <span className="hidden md:block font-medium text-sm text-left leading-tight">{label}</span>
  </button>
);

export default DollFactoryApp;
