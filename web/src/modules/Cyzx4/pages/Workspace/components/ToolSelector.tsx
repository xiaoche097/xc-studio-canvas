/**
 * 工具选择组件
 * 
 * 演示如何使用 UI Store 管理工具状态
 * 替代原 Workspace.tsx 中的工具选择逻辑
 */

import React from 'react';
import { MousePointer2, Hand, MapPin } from 'lucide-react';
import { useUIStore } from '../../../stores/ui.store';

type ToolType = 'select' | 'hand' | 'mark';

interface Tool {
  id: ToolType;
  name: string;
  icon: React.ComponentType<{ size?: number }>;
  shortcut: string;
}

const TOOLS: Tool[] = [
  { id: 'select', name: 'Select', icon: MousePointer2, shortcut: 'V' },
  { id: 'hand', name: 'Hand tool', icon: Hand, shortcut: 'H' },
  { id: 'mark', name: 'Mark', icon: MapPin, shortcut: 'M' },
];

export const ToolSelector: React.FC = () => {
  const activeTool = useUIStore(state => state.activeTool);
  const { setActiveTool } = useUIStore(state => state.actions);

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-2 flex flex-col gap-2">
      {TOOLS.map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;

        return (
          <div key={tool.id} className="relative group">
            <button
              onClick={() => setActiveTool(tool.id)}
              className={`p-2 rounded-xl transition ${
                isActive
                  ? 'text-black bg-gray-100'
                  : 'text-gray-400 hover:text-black hover:bg-gray-50'
              }`}
            >
              <Icon size={18} />
            </button>

            {/* Tooltip */}
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-sm">
              {tool.name}
              <span className="ml-2 text-gray-400">{tool.shortcut}</span>
              <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 border-4 border-transparent border-r-gray-900"></div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
