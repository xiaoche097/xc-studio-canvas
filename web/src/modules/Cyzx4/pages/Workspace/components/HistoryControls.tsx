/**
 * 历史记录控制组件
 * 
 * 演示如何使用 Canvas Store 管理撤销/重做功能
 * 替代原 Workspace.tsx 中的历史记录逻辑
 */

import React from 'react';
import { Undo2, Redo2 } from 'lucide-react';
import { useCanvasStore } from '../../../stores/canvas.store';

export const HistoryControls: React.FC = () => {
  const historyStep = useCanvasStore(state => state.historyStep);
  const historyLength = useCanvasStore(state => state.history.length);
  const { undo, redo } = useCanvasStore(state => state.actions);

  const canUndo = historyStep > 0;
  const canRedo = historyStep < historyLength - 1;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={undo}
        disabled={!canUndo}
        className={`p-2 rounded-xl transition ${
          canUndo
            ? 'text-gray-600 hover:text-black hover:bg-gray-50'
            : 'text-gray-300 cursor-not-allowed'
        }`}
        title="撤销 (Ctrl+Z)"
      >
        <Undo2 size={18} />
      </button>

      <button
        onClick={redo}
        disabled={!canRedo}
        className={`p-2 rounded-xl transition ${
          canRedo
            ? 'text-gray-600 hover:text-black hover:bg-gray-50'
            : 'text-gray-300 cursor-not-allowed'
        }`}
        title="重做 (Ctrl+Y)"
      >
        <Redo2 size={18} />
      </button>

      {/* 历史步骤指示器 */}
      <div className="ml-2 text-xs text-gray-500 font-mono">
        {historyStep + 1} / {historyLength}
      </div>
    </div>
  );
};
