/**
 * Workspace 重构示例
 * 
 * 这个文件展示了如何使用新的 Store 和组件来重构 Workspace.tsx
 * 对比原版的 60+ useState，这个版本干净、简洁、易维护
 * 
 * 使用说明：
 * 1. 这是一个示例文件，展示重构后的结构
 * 2. 可以逐步将这些改进应用到实际的 Workspace.tsx
 * 3. 建议先在测试环境中验证功能
 */

import React, { useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

// 导入新的组件
import {
  LayersPanel,
  CanvasToolbar,
  ProjectHeader,
  ToolSelector,
} from './components';

// 导入 Store
import { useCanvasStore } from '../../stores/canvas.store';
import { useUIStore } from '../../stores/ui.store';
import { useAgentStore } from '../../stores/agent.store';

// 导入服务
import { getProject, saveProject } from '../../services/storage';

/**
 * 重构后的 Workspace 组件
 * 
 * 主要改进：
 * 1. ✅ 使用 3个 Store 替代 60+ useState
 * 2. ✅ 组件化：拆分为多个小组件
 * 3. ✅ 职责清晰：每个部分各司其职
 * 4. ✅ 性能优化：精准的状态订阅
 */
const WorkspaceRefactored: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const containerRef = useRef<HTMLDivElement>(null);

  // ========================================
  // 从 Store 读取状态（替代原来的 useState）
  // ========================================
  
  // Canvas Store
  const zoom = useCanvasStore(state => state.zoom);
  const pan = useCanvasStore(state => state.pan);
  const elements = useCanvasStore(state => state.elements);
  const selectedElementId = useCanvasStore(state => state.selectedElementId);
  const markers = useCanvasStore(state => state.markers);
  const { 
    setZoom, 
    setPan, 
    setElements, 
    setMarkers,
    saveToHistory 
  } = useCanvasStore(state => state.actions);

  // UI Store
  const showAssistant = useUIStore(state => state.showAssistant);
  const activeTool = useUIStore(state => state.activeTool);
  const isSpacePressed = useUIStore(state => state.isSpacePressed);
  const { setIsSpacePressed } = useUIStore(state => state.actions);

  // Agent Store
  const messages = useAgentStore(state => state.messages);
  const isTyping = useAgentStore(state => state.isTyping);

  // ========================================
  // 本地状态（仅用于临时UI交互）
  // ========================================
  const [isPanning, setIsPanning] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });

  // ========================================
  // 项目加载和保存
  // ========================================
  useEffect(() => {
    if (!id) return;
    
    // 加载项目
    const loadProject = async () => {
      const project = await getProject(id);
      if (project?.elements) {
        setElements(project.elements);
      }
      if (project?.markers) {
        setMarkers(project.markers);
      }
    };
    
    loadProject();
  }, [id]);

  // 自动保存
  useEffect(() => {
    if (!id) return;
    
    const saveTimeout = setTimeout(async () => {
      await saveProject({
        id,
        title: '项目标题', // 可以从一个单独的 project store 获取
        updatedAt: new Date().toISOString(),
        elements,
        markers,
      });
    }, 1000);

    return () => clearTimeout(saveTimeout);
  }, [elements, markers, id]);

  // ========================================
  // 键盘事件（简化版）
  // ========================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 空格键 - 临时启用手型工具
      if (e.code === 'Space' && !e.repeat) {
        const isTyping = 
          document.activeElement?.tagName === 'TEXTAREA' ||
          document.activeElement?.tagName === 'INPUT';
        
        if (!isTyping) {
          e.preventDefault();
          setIsSpacePressed(true);
        }
      }

      // Cmd/Ctrl + 和 - 缩放
      if ((e.metaKey || e.ctrlKey) && e.key === '=') {
        e.preventDefault();
        setZoom(Math.min(500, zoom + 10));
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault();
        setZoom(Math.max(10, zoom - 10));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [zoom]);

  // ========================================
  // 鼠标事件（简化版）
  // ========================================
  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeTool === 'hand' || isSpacePressed) {
      setIsPanning(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setPan({ x: pan.x + dx, y: pan.y + dy });
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // ========================================
  // 渲染
  // ========================================
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F9FAFB]">
      
      {/* 左侧工具栏 */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-50">
        <ToolSelector />
      </div>

      {/* 主画布区域 */}
      <div className="flex-1 relative flex flex-col h-full overflow-hidden">
        
        {/* 顶部标题栏 */}
        <div 
          className="absolute top-6 left-6 right-6 flex justify-between items-start z-30 pointer-events-none"
          style={{ paddingRight: showAssistant ? '420px' : '0' }}
        >
          <ProjectHeader 
            initialTitle="未命名项目"
            onTitleChange={(title) => console.log('Title changed:', title)}
          />

          {/* 右上角工具栏 */}
          <CanvasToolbar />
        </div>

        {/* 画布容器 */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden relative bg-[#F9FAFB] cursor-default"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            cursor: isPanning ? 'grabbing' : (isSpacePressed ? 'grab' : 'default')
          }}
        >
          {/* 画布内容 - 使用 transform 实现缩放和平移 */}
          <div
            className="absolute top-0 left-0 w-0 h-0 overflow-visible transition-transform duration-75"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`,
              transformOrigin: '0 0'
            }}
          >
            {/* 渲染元素 */}
            {elements.map(element => (
              <div
                key={element.id}
                className="absolute"
                style={{
                  left: element.x,
                  top: element.y,
                  width: element.width,
                  height: element.height,
                  zIndex: element.zIndex
                }}
              >
                {/* 这里渲染具体的元素内容 */}
                {element.type === 'image' && element.url && (
                  <img src={element.url} className="w-full h-full" alt="" />
                )}
                {element.type === 'text' && (
                  <div style={{ fontSize: element.fontSize }}>
                    {element.text}
                  </div>
                )}
                {/* ... 其他元素类型 */}
              </div>
            ))}

            {/* 渲染标记 */}
            {markers.map(marker => {
              const element = elements.find(el => el.id === marker.elementId);
              if (!element) return null;

              const pixelX = element.x + (element.width * marker.x / 100);
              const pixelY = element.y + (element.height * marker.y / 100);

              return (
                <div
                  key={marker.id}
                  className="absolute w-8 h-8 rounded-full bg-blue-500 border-2 border-white shadow-lg flex items-center justify-center text-white font-bold text-sm"
                  style={{
                    left: pixelX,
                    top: pixelY,
                    transform: 'translate(-50%, -100%)'
                  }}
                >
                  {marker.id}
                </div>
              );
            })}
          </div>
        </div>

        {/* 图层面板 */}
        <LayersPanel />
      </div>

      {/* 右侧助手面板 */}
      <AnimatePresence>
        {showAssistant && (
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            className="absolute top-4 right-4 w-[400px] bottom-4 bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 z-40"
          >
            {/* 助手面板内容 */}
            <div className="h-full flex flex-col p-4">
              <h3 className="font-bold text-lg mb-4">AI 助手</h3>
              
              {/* 消息列表 */}
              <div className="flex-1 overflow-y-auto space-y-3">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-lg ${
                      msg.role === 'user' 
                        ? 'bg-blue-500 text-white ml-auto max-w-[80%]' 
                        : 'bg-gray-100 text-gray-800 mr-auto max-w-[80%]'
                    }`}
                  >
                    {msg.text}
                  </div>
                ))}
                {isTyping && (
                  <div className="bg-gray-100 rounded-lg p-3 max-w-[80%]">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                    </div>
                  </div>
                )}
              </div>

              {/* 输入区域 */}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <input
                  type="text"
                  placeholder="输入消息..."
                  className="w-full bg-transparent border-none outline-none"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WorkspaceRefactored;
