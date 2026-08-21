/**
 * 画布工具栏组件
 * 
 * 展示如何使用 UI Store 和 Canvas Store 管理工具栏
 * 包含：缩放控制、撤销重做、助手切换
 */

import React from 'react';
import { Minus, Plus, Sparkles } from 'lucide-react';
import { useCanvasStore } from '../../../stores/canvas.store';
import { useUIStore } from '../../../stores/ui.store';
import { ZoomControls } from './ZoomControls';
import { HistoryControls } from './HistoryControls';

export const CanvasToolbar: React.FC = () => {
  const showAssistant = useUIStore(state => state.showAssistant);
  const { toggleAssistant } = useUIStore(state => state.actions);

  return (
    <div className="absolute top-6 right-6 flex items-center gap-2 pointer-events-auto z-30">
      {/* Zoom Controls */}
      <ZoomControls />

      {/* History Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200/80 flex items-center p-1 gap-1 h-9">
        <HistoryControls />
      </div>

      {/* Toggle Assistant */}
      {!showAssistant && (
        <button
          onClick={toggleAssistant}
          className="w-9 h-9 bg-white rounded-xl shadow-sm border border-gray-200/80 flex items-center justify-center text-black hover:bg-gray-50 transition"
          title="显示助手"
        >
          <Sparkles size={16} fill="currentColor" />
        </button>
      )}
    </div>
  );
};
