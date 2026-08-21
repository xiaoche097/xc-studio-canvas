/**
 * 🎓 Store 使用示例组件
 * 
 * 这个组件展示了如何在实际组件中使用 Zustand Store
 * 可以作为迁移其他组件的参考
 */

import React from 'react';
import { useCanvasStore } from '../../../stores/canvas.store';
import { useUIStore } from '../../../stores/ui.store';
import { useAgentStore } from '../../../stores/agent.store';

export const ExampleStoreUsage: React.FC = () => {
  // ✅ 1. 读取 Canvas Store 状态
  const zoom = useCanvasStore(state => state.zoom);
  const elements = useCanvasStore(state => state.elements);
  const selectedElementId = useCanvasStore(state => state.selectedElementId);
  
  // ✅ 2. 获取 Canvas Store 操作方法
  const { setZoom, addElement, updateElement, undo, redo } = useCanvasStore(
    state => state.actions
  );

  // ✅ 3. 读取 UI Store 状态
  const activeTool = useUIStore(state => state.activeTool);
  const showAssistant = useUIStore(state => state.showAssistant);
  
  // ✅ 4. 获取 UI Store 操作方法
  const { setActiveTool, toggleAssistant } = useUIStore(state => state.actions);

  // ✅ 5. 读取 Agent Store 状态
  const messages = useAgentStore(state => state.messages);
  const isTyping = useAgentStore(state => state.isTyping);
  
  // ✅ 6. 获取 Agent Store 操作方法
  const { addMessage, setIsTyping } = useAgentStore(state => state.actions);

  // 示例：添加矩形元素
  const handleAddRect = () => {
    addElement({
      id: `rect-${Date.now()}`,
      type: 'shape',
      shapeType: 'square',
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      zIndex: elements.length + 1,
      fillColor: '#3B82F6',
      strokeColor: 'transparent',
    });
  };

  // 示例：发送消息
  const handleSendMessage = () => {
    addMessage({
      id: `msg-${Date.now()}`,
      role: 'user',
      text: '这是一条测试消息',
      timestamp: Date.now(),
    });
  };

  return (
    <div className="p-6 bg-white rounded-xl border border-gray-200 space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Store 使用示例</h2>
      
      {/* Canvas Store 示例 */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-700">📦 Canvas Store</h3>
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500">缩放级别:</span>
            <span className="ml-2 font-mono text-blue-600">{zoom}%</span>
          </div>
          <div>
            <span className="text-gray-500">元素数量:</span>
            <span className="ml-2 font-mono text-blue-600">{elements.length}</span>
          </div>
          <div>
            <span className="text-gray-500">选中ID:</span>
            <span className="ml-2 font-mono text-blue-600">
              {selectedElementId || 'null'}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setZoom(zoom + 10)}
            className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
          >
            放大
          </button>
          <button
            onClick={() => setZoom(zoom - 10)}
            className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
          >
            缩小
          </button>
          <button
            onClick={handleAddRect}
            className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600"
          >
            添加矩形
          </button>
          <button
            onClick={undo}
            className="px-3 py-1.5 bg-gray-500 text-white rounded-lg text-sm hover:bg-gray-600"
          >
            撤销
          </button>
          <button
            onClick={redo}
            className="px-3 py-1.5 bg-gray-500 text-white rounded-lg text-sm hover:bg-gray-600"
          >
            重做
          </button>
        </div>
      </div>

      {/* UI Store 示例 */}
      <div className="space-y-3 pt-4 border-t border-gray-200">
        <h3 className="font-semibold text-gray-700">🎛️ UI Store</h3>
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500">当前工具:</span>
            <span className="ml-2 font-mono text-purple-600">{activeTool}</span>
          </div>
          <div>
            <span className="text-gray-500">助手面板:</span>
            <span className="ml-2 font-mono text-purple-600">
              {showAssistant ? '显示' : '隐藏'}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setActiveTool('select')}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              activeTool === 'select'
                ? 'bg-purple-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            选择
          </button>
          <button
            onClick={() => setActiveTool('hand')}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              activeTool === 'hand'
                ? 'bg-purple-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            手型
          </button>
          <button
            onClick={() => setActiveTool('mark')}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              activeTool === 'mark'
                ? 'bg-purple-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            标记
          </button>
          <button
            onClick={toggleAssistant}
            className="px-3 py-1.5 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600"
          >
            切换助手
          </button>
        </div>
      </div>

      {/* Agent Store 示例 */}
      <div className="space-y-3 pt-4 border-t border-gray-200">
        <h3 className="font-semibold text-gray-700">🤖 Agent Store</h3>
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500">消息数量:</span>
            <span className="ml-2 font-mono text-green-600">{messages.length}</span>
          </div>
          <div>
            <span className="text-gray-500">输入状态:</span>
            <span className="ml-2 font-mono text-green-600">
              {isTyping ? '输入中...' : '空闲'}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSendMessage}
            className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600"
          >
            发送消息
          </button>
          <button
            onClick={() => setIsTyping(!isTyping)}
            className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600"
          >
            切换输入状态
          </button>
        </div>

        {/* 消息列表 */}
        {messages.length > 0 && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg max-h-40 overflow-y-auto">
            <div className="text-xs text-gray-500 mb-2">最近消息:</div>
            {messages.slice(-5).map(msg => (
              <div key={msg.id} className="text-sm mb-1">
                <span className="font-semibold text-gray-700">{msg.role}:</span>{' '}
                <span className="text-gray-600">{msg.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 使用提示 */}
      <div className="pt-4 border-t border-gray-200">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">💡 使用提示</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• 使用选择器只订阅需要的状态，避免不必要的重渲染</li>
            <li>• actions 通过 state.actions 获取，包含所有操作方法</li>
            <li>• Store 内部使用 Immer，可以直接修改状态（会自动转换为不可变更新）</li>
            <li>• 可以在组件外使用 useCanvasStore.getState() 获取状态</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
