import React from 'react';
import { X, Move } from 'lucide-react';

interface ShortcutsDialogProps {
  onClose: () => void;
}

export const ShortcutsDialog: React.FC<ShortcutsDialogProps> = ({ onClose }) => {
  return (
    <div className="fixed bottom-20 right-6 z-[60] animate-in slide-in-from-bottom-5 fade-in duration-200 pointer-events-auto">
      <div className="bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl p-6 w-[400px] text-gray-200 relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>

        <div className="grid grid-cols-2 gap-8">
          {/* Column 1: Zoom & Nav */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-4">缩放</h3>
            <div className="space-y-3">
              <ShortcutRow label="放大" keys={['Ctrl', '+']} />
              <ShortcutRow label="缩小" keys={['Ctrl', '-']} />
              <ShortcutRow label="键盘" keys={['Ctrl', '0']} />
              <div className="flex items-center justify-between text-xs h-6">
                <span className="text-gray-400">触控板</span>
                <Move size={14} className="text-gray-500 rotate-45" />
              </div>
            </div>

            <h3 className="text-sm font-medium text-gray-500 mt-6 mb-4">移动画布</h3>
            <div className="space-y-3">
              <ShortcutRow label="键盘" keys={['Space']} />
              <div className="flex items-center justify-between text-xs h-6">
                <span className="text-gray-400">触控板</span>
                <span className="text-[10px] text-gray-500">双指拖动</span>
              </div>
            </div>
          </div>

          {/* Column 2: Other */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-4">其他</h3>
            <div className="space-y-3">
              <ShortcutRow label="删除" keys={['Del']} />
              <ShortcutRow label="撤销" keys={['Ctrl', 'Z']} />
              <ShortcutRow label="重做" keys={['Shift', 'Ctrl', 'Z']} />
              <ShortcutRow label="复制" keys={['Ctrl', 'C']} />
              <ShortcutRow label="粘贴" keys={['Ctrl', 'V']} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ShortcutRow = ({ label, keys }: { label: string, keys: string[] }) => (
  <div className="flex items-center justify-between text-xs h-6">
    <span className="text-gray-400">{label}</span>
    <div className="flex items-center gap-1">
      {keys.map((k, i) => (
        <span key={i} className="px-1.5 py-0.5 bg-[#2a2a2a] border border-white/10 rounded-[4px] text-[10px] font-mono text-gray-300 min-w-[20px] text-center">
          {k}
        </span>
      ))}
    </div>
  </div>
);