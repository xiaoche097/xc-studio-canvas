import React, { useState } from 'react';
import { AppMode } from './types';
import DirectorTab from './components/DirectorTab';
import HDUpscaleTab from './components/HDUpscaleTab';
import TrendTab from './components/TrendTab';
import StyleReplicateTab from './components/StyleReplicateTab';
import ImageCleanTab from './components/ImageCleanTab';
import FusionTab from './components/FusionTab';
import SeatCoverTab from './components/SeatCoverTab';
import ProductSwapTab from './components/ProductSwapTab';
import SettingsTab from './components/SettingsTab';
import { Activity, Aperture, Camera, FileText, Film, Wand2, Layers, CarFront, Settings, Palette, ArrowLeftRight, Sparkles } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppMode>(AppMode.PLANNING);
  const [sharedImage, setSharedImage] = useState<string | null>(null);

  const handleImageGenerated = (url: string) => {
    setSharedImage(url);
  };

  return (
    <div className="flex h-screen bg-pastel-bg text-pastel-text overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-20 md:w-64 bg-pastel-card border-r border-pastel-border flex flex-col flex-shrink-0 z-20 shadow-sm">
        <div className="h-16 flex items-center justify-center md:justify-start md:px-6 border-b border-pastel-border">
          <button
            onClick={() => window.location.href = '/'}
            className="bg-pastel-highlight text-white px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 shadow-sm hover:bg-orange-600 transition-colors w-10/12 md:w-auto justify-center"
          >
            <span>←</span>
            <span className="hidden md:inline">Back to Studio</span>
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
          <div className="text-xs font-bold text-pastel-muted uppercase tracking-wider px-3 mb-2 hidden md:block">工作台</div>

          <NavButton
            active={activeTab === AppMode.PLANNING}
            onClick={() => setActiveTab(AppMode.PLANNING)}
            icon={<Camera className="w-5 h-5" />}
            label="视觉策划"
          />
          <NavButton
            active={activeTab === AppMode.SEAT_COVER}
            onClick={() => setActiveTab(AppMode.SEAT_COVER)}
            icon={<CarFront className="w-5 h-5" />}
            label="座套试装"
          />
          <NavButton
            active={activeTab === AppMode.PRODUCT_SWAP}
            onClick={() => setActiveTab(AppMode.PRODUCT_SWAP)}
            icon={<ArrowLeftRight className="w-5 h-5" />}
            label="产品替换"
          />
          <NavButton
            active={activeTab === AppMode.FUSION}
            onClick={() => setActiveTab(AppMode.FUSION)}
            icon={<Layers className="w-5 h-5" />}
            label="图像生成"
          />
          <NavButton
            active={activeTab === AppMode.RETOUCHING}
            onClick={() => setActiveTab(AppMode.RETOUCHING)}
            icon={<Wand2 className="w-5 h-5" />}
            label="高清放大"
          />

          <div className="h-4"></div>
          <div className="text-xs font-bold text-pastel-muted uppercase tracking-wider px-3 mb-2 hidden md:block">营销生成</div>

          <NavButton
            active={activeTab === AppMode.COPYWRITING}
            onClick={() => setActiveTab(AppMode.COPYWRITING)}
            icon={<Palette className="w-5 h-5" />}
            label="风格复刻"
          />
          <NavButton
            active={activeTab === AppMode.IMAGE_CLEAN}
            onClick={() => setActiveTab(AppMode.IMAGE_CLEAN)}
            icon={<Sparkles className="w-5 h-5" />}
            label="AI 洗图"
          />
          <NavButton
            active={activeTab === AppMode.TRENDS}
            onClick={() => setActiveTab(AppMode.TRENDS)}
            icon={<Activity className="w-5 h-5" />}
            label="趋势洞察"
          />
          <NavButton
            active={activeTab === AppMode.SETTINGS}
            onClick={() => setActiveTab(AppMode.SETTINGS)}
            icon={<Settings className="w-5 h-5" />}
            label="设置"
          />
        </nav>


      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-16 bg-pastel-card/80 backdrop-blur-md border-b border-pastel-border flex items-center px-6 justify-between flex-shrink-0">
          <h1 className="text-xl font-medium text-pastel-text">
            {activeTab === AppMode.PLANNING && "视觉策划 (Visual Planning)"}
            {activeTab === AppMode.SEAT_COVER && "座套试装 (Seat Cover Fit)"}
            {activeTab === AppMode.PRODUCT_SWAP && "产品替换 (Product Swap)"}
            {activeTab === AppMode.FUSION && "图像生成 (Image Generation)"}
            {activeTab === AppMode.RETOUCHING && "高清放大 (HD Upscale)"}
            {activeTab === AppMode.COPYWRITING && "风格复刻 (Style Replication)"}
            {activeTab === AppMode.COPYWRITING && "风格复刻 (Style Replication)"}
            {activeTab === AppMode.IMAGE_CLEAN && "AI 洗图 (Image Clean)"}
            {activeTab === AppMode.TRENDS && "趋势洞察 (Trend Insights)"}
            {activeTab === AppMode.SETTINGS && "设置 (Settings)"}
          </h1>
        </header>

        <div className="flex-1 overflow-auto p-0 relative">
          <div className="h-full w-full">
            {activeTab === AppMode.PLANNING && <DirectorTab onImageGenerated={handleImageGenerated} />}

            {/* Persist SeatCoverTab state by hiding instead of unmounting */}
            <div style={{ display: activeTab === AppMode.SEAT_COVER ? 'block' : 'none', height: '100%' }}>
              <SeatCoverTab />
            </div>

            {/* Persist ProductSwapTab state by hiding instead of unmounting */}
            <div style={{ display: activeTab === AppMode.PRODUCT_SWAP ? 'block' : 'none', height: '100%' }}>
              <ProductSwapTab />
            </div>

            {/* Persist FusionTab state by hiding instead of unmounting */}
            <div style={{ display: activeTab === AppMode.FUSION ? 'block' : 'none', height: '100%' }}>
              <FusionTab />
            </div>

            {/* Persist HDUpscaleTab state (Replacing EditorTab) */}
            <div style={{ display: activeTab === AppMode.RETOUCHING ? 'block' : 'none', height: '100%' }}>
              <HDUpscaleTab />
            </div>

            {/* Persist StyleReplicateTab state by hiding instead of unmounting */}
            <div style={{ display: activeTab === AppMode.COPYWRITING ? 'block' : 'none', height: '100%' }}>
              <StyleReplicateTab />
            </div>

            {activeTab === AppMode.IMAGE_CLEAN && <ImageCleanTab />}
            {activeTab === AppMode.TRENDS && <TrendTab />}
            {activeTab === AppMode.SETTINGS && <SettingsTab />}
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
  highlight?: boolean;
}> = ({ active, onClick, icon, label, highlight }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group ${active
      ? 'bg-pastel-pink text-pastel-text shadow-sm font-medium'
      : 'text-pastel-muted hover:bg-pastel-bg hover:text-pastel-highlight'
      } ${highlight && !active ? 'text-pastel-highlight' : ''}`}
  >
    <div className={`${active ? 'text-pastel-text' : 'group-hover:text-pastel-highlight'} transition-colors`}>
      {icon}
    </div>
    <span className="hidden md:block font-medium text-sm">{label}</span>
  </button>
);

export default App;