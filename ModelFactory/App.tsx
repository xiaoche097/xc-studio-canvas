import React, { useState } from 'react';
import PoseFissionTab from './PoseFissionTab.tsx';
import ModelAdjustTab from './ModelAdjustTabV2.tsx';
import ActionReferenceTab from './ActionReferenceTab.tsx';
import GarmentReplacementTab from './GarmentReplacementTab.tsx';
import OriginalGarmentExtractTab from './OriginalGarmentExtractTab.tsx';
import BatchRecolorTab from './BatchRecolorTab.tsx';
import ClothingModificationTab from './ClothingModificationTab.tsx';
import BatchPropsModifierTab from './BatchPropsModifierTab.tsx';
import { ArrowLeft, UserCircle2, Wand2, Move, Shirt, Palette, Scissors, ImageIcon } from 'lucide-react';

import ModelMainAdjustTab from './ModelMainAdjustTab.tsx';
import ModelGenerationTab from './ModelGenerationTab.tsx';

type ModelFactoryMode = 'model-main-adjust' | 'pose-fission' | 'model-adjust' | 'model-generation' | 'action-reference' | 'garment-replacement' | 'original-garment-extract' | 'batch-recolor' | 'clothing-modification' | 'batch-props-modifier';

const ModelFactoryApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ModelFactoryMode>('model-main-adjust');

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

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
          <div className="text-xs font-bold text-pastel-muted uppercase tracking-wider px-3 mb-2 hidden md:block">模特工厂</div>

          <NavButton
            active={activeTab === 'model-main-adjust'}
            onClick={() => setActiveTab('model-main-adjust')}
            icon={<Wand2 className="w-5 h-5" />}
            label="模特主图调整 (Model Main Adjust)"
          />

          <NavButton
            active={activeTab === 'pose-fission'}
            onClick={() => setActiveTab('pose-fission')}
            icon={<UserCircle2 className="w-5 h-5" />}
            label="姿势裂变 (Pose Fission)"
          />

          <NavButton
            active={activeTab === 'model-adjust'}
            onClick={() => setActiveTab('model-adjust')}
            icon={<Wand2 className="w-5 h-5" />}
            label="模特调整 (Pose Transfer)"
          />

          <NavButton
            active={activeTab === 'model-generation'}
            onClick={() => setActiveTab('model-generation')}
            icon={<ImageIcon className="w-5 h-5" />}
            label="模特生成"
          />

          <NavButton
            active={activeTab === 'action-reference'}
            onClick={() => setActiveTab('action-reference')}
            icon={<Move className="w-5 h-5" />}
            label="动作参考 (Action Reference)"
          />

          <NavButton
            active={activeTab === 'garment-replacement'}
            onClick={() => setActiveTab('garment-replacement')}
            icon={<Shirt className="w-5 h-5" />}
            label="批量替换 (Garment Replace)"
          />

          <NavButton
            active={activeTab === 'original-garment-extract'}
            onClick={() => setActiveTab('original-garment-extract')}
            icon={<Scissors className="w-5 h-5" />}
            label="原图服装提取 (Garment Extract)"
          />

          <NavButton
            active={activeTab === 'batch-recolor'}
            onClick={() => setActiveTab('batch-recolor')}
            icon={<Palette className="w-5 h-5" />}
            label="批量改色 (Batch Recolor)"
          />

          <NavButton
            active={activeTab === 'clothing-modification'}
            onClick={() => setActiveTab('clothing-modification')}
            icon={<Wand2 className="w-5 h-5" />}
            label="服装改款 (Clothing Modify)"
          />

          <NavButton
            active={activeTab === 'batch-props-modifier'}
            onClick={() => setActiveTab('batch-props-modifier')}
            icon={<Scissors className="w-5 h-5" />}
            label="批量修改道具 (Props Modifier)"
          />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-16 bg-pastel-card/80 backdrop-blur-md border-b border-pastel-border flex items-center px-6 justify-between flex-shrink-0">
          <h1 className="text-xl font-medium text-pastel-text">
            {activeTab === 'model-main-adjust' && "模特主图调整 (Model Main Adjust)"}
            {activeTab === 'pose-fission' && "姿势裂变 (Pose Fission)"}
            {activeTab === 'model-adjust' && "模特调整 (Pose Transfer)"}
            {activeTab === 'model-generation' && "模特生成"}
            {activeTab === 'action-reference' && "动作参考 (Action Reference)"}
            {activeTab === 'garment-replacement' && "批量替换 (Garment Replace)"}
            {activeTab === 'original-garment-extract' && "原图服装提取 (Garment Extract)"}
            {activeTab === 'batch-recolor' && "批量改色 (Batch Recolor)"}
            {activeTab === 'clothing-modification' && "服装改款 (Clothing Modify)"}
            {activeTab === 'batch-props-modifier' && "批量修改道具 (Props Modifier)"}
          </h1>
        </header>

        <div className="flex-1 overflow-auto p-0 relative">
          <div className="h-full w-full">
            <div style={{ display: activeTab === 'model-main-adjust' ? 'block' : 'none', height: '100%' }}>
              <ModelMainAdjustTab isActive={activeTab === 'model-main-adjust'} />
            </div>
            <div style={{ display: activeTab === 'pose-fission' ? 'block' : 'none', height: '100%' }}>
              <PoseFissionTab />
            </div>
            <div style={{ display: activeTab === 'model-adjust' ? 'block' : 'none', height: '100%' }}>
              <ModelAdjustTab isActive={activeTab === 'model-adjust'} />
            </div>
            <div style={{ display: activeTab === 'model-generation' ? 'block' : 'none', height: '100%' }}>
              <ModelGenerationTab isActive={activeTab === 'model-generation'} />
            </div>
            <div style={{ display: activeTab === 'action-reference' ? 'block' : 'none', height: '100%' }}>
              <ActionReferenceTab isActive={activeTab === 'action-reference'} />
            </div>
            <div style={{ display: activeTab === 'garment-replacement' ? 'block' : 'none', height: '100%' }}>
              <GarmentReplacementTab isActive={activeTab === 'garment-replacement'} />
            </div>
            <div style={{ display: activeTab === 'original-garment-extract' ? 'block' : 'none', height: '100%' }}>
              <OriginalGarmentExtractTab isActive={activeTab === 'original-garment-extract'} />
            </div>
            <div style={{ display: activeTab === 'batch-recolor' ? 'block' : 'none', height: '100%' }}>
              <BatchRecolorTab isActive={activeTab === 'batch-recolor'} />
            </div>
            <div style={{ display: activeTab === 'clothing-modification' ? 'block' : 'none', height: '100%' }}>
              <ClothingModificationTab isActive={activeTab === 'clothing-modification'} />
            </div>
            <div style={{ display: activeTab === 'batch-props-modifier' ? 'block' : 'none', height: '100%' }}>
              <BatchPropsModifierTab isActive={activeTab === 'batch-props-modifier'} />
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
    <span className="hidden md:block font-medium text-sm text-left leading-tight">{label}</span>
  </button>
);

export default ModelFactoryApp;
