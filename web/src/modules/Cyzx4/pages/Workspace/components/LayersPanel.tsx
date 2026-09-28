/**
 * 图层面板组件
 * 
 * 展示如何使用 Canvas Store 和 UI Store 管理图层显示
 * 替代原 Workspace.tsx 中的图层面板逻辑
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown, ChevronRight, Plus, History, Minimize2,
  ImageIcon, Video, Box, Type, ImagePlus
} from 'lucide-react';
import { useCanvasStore } from '../../../stores/canvas.store';
import { useUIStore } from '../../../stores/ui.store';

export const LayersPanel: React.FC = () => {
  const showLayersPanel = useUIStore(state => state.showLayersPanel);
  const { toggleLayersPanel } = useUIStore(state => state.actions);
  
  const elements = useCanvasStore(state => state.elements);
  const selectedElementId = useCanvasStore(state => state.selectedElementId);
  const { setSelectedElementId } = useCanvasStore(state => state.actions);
  
  const [isCollapsed, setIsCollapsed] = React.useState(true);

  if (!showLayersPanel) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: -20, y: 20 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={{ opacity: 0, x: -20, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={`absolute bottom-4 left-4 z-50 flex flex-col ${
          isCollapsed ? 'w-auto' : 'w-64 max-h-[60vh] bg-white/90 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl overflow-hidden'
        }`}
      >
        {isCollapsed ? (
          <button
            onClick={() => setIsCollapsed(false)}
            className="bg-white/90 backdrop-blur-md border border-white/20 shadow-lg rounded-xl px-4 py-2.5 flex items-center gap-2 hover:scale-105 transition active:scale-95 group"
          >
            <History size={16} className="text-gray-600 group-hover:text-black" />
            <span className="text-sm font-medium text-gray-700 group-hover:text-black">
              Layers & History
            </span>
            <ChevronRight size={16} className="text-gray-400 group-hover:text-black ml-1" />
          </button>
        ) : (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-gray-100/50 flex justify-between items-center bg-transparent sticky top-0 z-10">
              <span className="font-semibold text-gray-900">历史记录</span>
              <button
                onClick={() => setIsCollapsed(true)}
                className="text-gray-400 hover:text-black transition"
              >
                <ChevronDown size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col p-2">
              {/* History placeholder */}
              <div className="h-32 bg-gray-50/50 rounded-lg flex flex-col items-center justify-center text-gray-400 text-xs border border-dashed border-gray-200 mb-4">
                <div className="mb-2">
                  <ImageIcon size={32} className="opacity-10" />
                </div>
                暂无历史记录
              </div>

              {/* Layers Section */}
              <div className="border-t border-gray-100/50 pt-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
                  图层
                </h3>
                
                <div className="space-y-1">
                  {/* Add Layer Button */}
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="flex items-center gap-3 p-2 rounded-lg cursor-pointer text-sm text-gray-500 hover:bg-black/5 hover:text-black transition group border border-dashed border-gray-200 hover:border-gray-300 justify-center mb-2"
                  >
                    <Plus size={14} /> Add Layer
                  </motion.div>

                  {/* Layer List */}
                  {[...elements].reverse().map(el => {
                    const isSelected = selectedElementId === el.id;
                    
                    return (
                      <motion.div
                        layoutId={el.id}
                        key={el.id}
                        onClick={() => setSelectedElementId(el.id)}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer text-sm transition group border border-transparent ${
                          isSelected
                            ? 'bg-blue-50 border-blue-100'
                            : 'hover:bg-black/5 hover:border-transparent'
                        }`}
                      >
                        {/* Icon */}
                        <div className="w-10 h-10 bg-white rounded-md border border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
                          {el.type === 'text' && (
                            <span className="font-serif text-gray-500 text-lg">T</span>
                          )}
                          {el.type === 'image' && el.url && (
                            <img src={el.url} className="w-full h-full object-cover" alt="" />
                          )}
                          {(el.type === 'video' || el.type === 'gen-video') && (
                            <Video size={16} className="text-gray-500" />
                          )}
                          {el.type === 'shape' && (
                            <Box size={16} className="text-gray-500" />
                          )}
                          {el.type === 'gen-image' && (
                            <ImagePlus size={16} className="text-blue-500" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <div className="truncate text-gray-700 font-medium text-xs leading-tight mb-0.5">
                            {el.type === 'text'
                              ? (el.text || 'Text Layer')
                              : el.type === 'gen-image'
                              ? 'Image Generator'
                              : el.type === 'gen-video'
                              ? 'Video Generator'
                              : el.type === 'image'
                              ? `Image ${el.id.slice(-4)}`
                              : el.type === 'shape'
                              ? `${el.shapeType || 'Shape'}`
                              : 'Element'}
                          </div>
                          <div className="truncate text-gray-400 text-[10px]">
                            {el.type === 'text'
                              ? 'Text'
                              : el.type === 'gen-image'
                              ? 'AI Model'
                              : el.type === 'gen-video'
                              ? 'AI Video'
                              : 'Graphic'}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-2 border-t border-gray-100/50">
              <button
                onClick={() => setIsCollapsed(true)}
                className="w-full flex items-center justify-center p-2 text-gray-400 hover:text-black hover:bg-black/5 rounded-lg transition"
                title="Collapse Panel"
              >
                <Minimize2 size={16} />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
