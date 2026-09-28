/**
 * 缩放控制组件
 * 
 * 演示如何使用 Canvas Store 管理缩放状态
 * 这是从 Workspace.tsx 拆分出来的第一个实用组件
 */

import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { useCanvasStore } from '../../../stores/canvas.store';

export const ZoomControls: React.FC = () => {
  // 只订阅需要的状态
  const zoom = useCanvasStore(state => state.zoom);
  const { setZoom } = useCanvasStore(state => state.actions);

  const handleZoomIn = () => setZoom(zoom + 10);
  const handleZoomOut = () => setZoom(zoom - 10);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200/80 flex items-center p-1 gap-1 h-9">
      <button
        onClick={handleZoomOut}
        className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-black hover:bg-gray-50 rounded-lg transition"
        disabled={zoom <= 10}
      >
        <Minus size={14} />
      </button>
      
      <span className="text-xs font-medium w-8 text-center text-gray-700">
        {Math.round(zoom)}%
      </span>
      
      <button
        onClick={handleZoomIn}
        className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-black hover:bg-gray-50 rounded-lg transition"
        disabled={zoom >= 500}
      >
        <Plus size={14} />
      </button>
    </div>
  );
};
