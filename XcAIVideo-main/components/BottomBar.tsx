import React from 'react';
import { ToolbarProps } from '../types';
import { 
  Map, 
  Grid,
  Target, 
  HelpCircle
} from 'lucide-react';
import { MIN_SCALE, MAX_SCALE } from '../constants';

export const BottomBar: React.FC<ToolbarProps> = ({ 
  scale, 
  onScaleChange, 
  onReset, 
  onShowShortcuts,
  showMinimap,
  onToggleMinimap
}) => {
  
  // Convert scale to percentage for display
  const percentage = Math.round(scale * 100);

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-[#1a1a1a]/90 backdrop-blur-md rounded-full border border-white/5 shadow-2xl select-none pointer-events-auto">
      
      {/* Mini-map Toggle */}
      <button 
        onClick={onToggleMinimap}
        className={`p-2 rounded-full transition-colors ${showMinimap ? 'text-white bg-white/20' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
        title="小地图"
      >
        <Map size={18} />
      </button>

      {/* Snap to Grid (Placeholder) */}
      <button 
        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
        title="网格吸附"
      >
        <Grid size={18} />
      </button>

      {/* Divider */}
      <div className="w-px h-4 bg-white/10 mx-1"></div>

      {/* Reset View */}
      <button 
        onClick={onReset}
        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors group"
        title="重置视角"
      >
        <Target size={18} className="group-active:scale-90 transition-transform" />
      </button>

      {/* Zoom Controls */}
      <div className="flex items-center gap-3 px-2">
        {/* Scale Percentage Display */}
        <span className="text-xs font-medium text-gray-300 min-w-[3ch] text-right tabular-nums">
          {percentage}%
        </span>

        {/* Slider */}
        <div className="w-24 flex items-center">
            <input
            type="range"
            min={MIN_SCALE}
            max={MAX_SCALE}
            step={0.1}
            value={scale}
            onChange={(e) => onScaleChange(parseFloat(e.target.value))}
            className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-white/10 mx-1"></div>

      {/* Help */}
      <button 
        onClick={onShowShortcuts}
        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
        title="快捷键"
      >
        <HelpCircle size={18} />
      </button>
    </div>
  );
};