import React, { useRef, useEffect, useState } from 'react';
import { X, Plus, Wand2, Video as VideoIcon, Image as ImageIcon, Type as TypeIcon, Music, Upload } from 'lucide-react';
import { NodeData } from '../types';
import { GRID_SIZE } from '../constants';
import { ImageGenNode } from './ImageGenNode';

interface NodeCardProps {
  node: NodeData;
  scale: number;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  onPositionChange: (id: string, newPos: { x: number; y: number }) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onPortDown: (e: React.PointerEvent, nodeId: string, type: 'source' | 'target') => void;
  onAddConnectedNode?: (nodeId: string) => void;
  onUpload?: (nodeId: string) => void;
  onResize?: (id: string, size: { width: number; height: number }) => void;
}

export const NodeCard: React.FC<NodeCardProps> = ({ 
  node, 
  scale, 
  onDelete, 
  onSelect, 
  onPositionChange,
  onDragStart,
  onDragEnd,
  onPortDown,
  onAddConnectedNode,
  onUpload,
  onResize
}) => {
  const [dragState, setDragState] = useState<{
    startX: number;
    startY: number;
    nodeStartX: number;
    nodeStartY: number;
  } | null>(null);
  
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Track size changes (especially for images) so lines stay connected to the center
  useEffect(() => {
    if (!cardRef.current || !onResize) return;
    
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Only trigger update if dimensions actually changed
        if (entry.contentRect.height !== node.height || entry.contentRect.width !== node.width) {
            onResize(node.id, { 
                width: entry.contentRect.width, 
                height: entry.contentRect.height 
            });
        }
      }
    });
    
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [node.id, onResize, node.width, node.height]);

  // Determine if this node is acting as a static asset (uploaded/generated content)
  // For 'image' type: If content starts with 'http' or 'data:', treat as asset. Otherwise treat as Gen Node.
  const isContentUrl = (content?: string) => content && (content.startsWith('http') || content.startsWith('data:'));
  const isAssetMode = (node.type === 'video' || (node.type === 'image' && isContentUrl(node.content))) && !!node.content;

  // Update handler for the specific ImageGenNode
  const handleNodeUpdate = (id: string, newData: Partial<NodeData>) => {
      console.log('Node Update:', id, newData);
  };


  // Handle Dragging with Snapping
  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation(); 
    e.preventDefault(); 
    
    if (e.button !== 0) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    
    setDragState({
        startX: e.clientX,
        startY: e.clientY,
        nodeStartX: node.position.x,
        nodeStartY: node.position.y
    });

    onSelect(node.id);
    if (onDragStart) onDragStart();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState) return;
    e.stopPropagation();
    e.preventDefault();

    const dx = (e.clientX - dragState.startX) / scale;
    const dy = (e.clientY - dragState.startY) / scale;
    
    const rawX = dragState.nodeStartX + dx;
    const rawY = dragState.nodeStartY + dy;

    // Snap to grid (GRID_SIZE)
    const snappedX = Math.round(rawX / GRID_SIZE) * GRID_SIZE;
    const snappedY = Math.round(rawY / GRID_SIZE) * GRID_SIZE;

    onPositionChange(node.id, {
      x: snappedX,
      y: snappedY,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragState) {
        setDragState(null);
        e.currentTarget.releasePointerCapture(e.pointerId);
        if (onDragEnd) onDragEnd();
    }
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
      if (cardRef.current && onResize) {
          onResize(node.id, {
              width: cardRef.current.offsetWidth,
              height: cardRef.current.offsetHeight
          });
      }
  };

  // --- 1. Asset Mode (Uploaded Images/Videos) ---
  if (isAssetMode) {
      return (
        <div
            ref={cardRef}
            className={`node-card absolute transition-all duration-200 select-none group flex flex-col pointer-events-auto outline-none ring-0`}
            style={{
                transform: `translate(${node.position.x}px, ${node.position.y}px)`,
                zIndex: node.selected ? 20 : 1,
                width: 320, 
            }}
            onClick={(e) => {
                 e.stopPropagation();
                 onSelect(node.id);
            }}
            onPointerDown={(e) => e.stopPropagation()} 
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {dragState && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-mono px-2 py-1 rounded shadow-lg pointer-events-none z-50 whitespace-nowrap animate-in fade-in zoom-in-95 duration-75">
                    X: {Math.round(node.position.x)} Y: {Math.round(node.position.y)}
                </div>
            )}

            <div 
                className={`relative rounded-xl overflow-hidden bg-[#1e1e1e] border cursor-grab active:cursor-grabbing outline-none ring-0
                    ${node.selected ? 'border-white/20' : 'border-[#333] hover:border-[#555]'}
                `}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
            >
                {node.type === 'image' && (
                    <img 
                        src={node.content} 
                        alt="Asset" 
                        className="w-full h-auto object-cover block bg-black/20"
                        draggable={false}
                        onLoad={handleImageLoad}
                    />
                )}
                {node.type === 'video' && (
                    <video 
                        src={node.content} 
                        controls 
                        className="w-full h-auto block bg-black/20"
                        onPointerDown={(e) => e.stopPropagation()} 
                    />
                )}

                <button 
                    onClick={(e) => { e.stopPropagation(); onUpload?.(node.id); }}
                    className={`absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-lg text-xs font-medium text-white border border-white/10 transition-opacity duration-200
                        ${isHovered ? 'opacity-100' : 'opacity-0'}
                    `}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <Upload size={12} />
                    <span>上传</span>
                </button>

                 {node.selected && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
                        className="absolute top-3 left-3 w-6 h-6 flex items-center justify-center rounded-full bg-red-500/80 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        <X size={12} />
                    </button>
                 )}
            </div>

            <Port type="target" position="left" nodeId={node.id} onDown={(e) => onPortDown(e, node.id, 'target')} />
            <Port type="source" position="right" nodeId={node.id} onDown={(e) => onPortDown(e, node.id, 'source')} />
        </div>
      );
  }

  // --- 2. Image Generation Node (Special Render) ---
  if (node.type === 'image') {
      return (
        <div
            ref={cardRef}
            className={`node-card absolute transition-all duration-200 select-none group flex flex-col pointer-events-auto outline-none ring-0`}
            style={{
                transform: `translate(${node.position.x}px, ${node.position.y}px)`,
                zIndex: node.selected ? 20 : 1,
                width: 320,
            }}
            onClick={(e) => {
                 e.stopPropagation();
                 onSelect(node.id);
            }}
        >
             {/* Position Tooltip */}
             {dragState && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-mono px-2 py-1 rounded shadow-lg pointer-events-none z-50 whitespace-nowrap animate-in fade-in zoom-in-95 duration-75">
                    X: {Math.round(node.position.x)} Y: {Math.round(node.position.y)}
                </div>
            )}

             {/* Delete Button */}
             {node.selected && (
                <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
                    className="absolute -top-2 -right-2 z-50 w-6 h-6 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-600 text-white shadow-md border border-white/20"
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <X size={12} />
                </button>
             )}

             {/* Drag Handle Wrapper */}
             <div 
                className="rounded-3xl outline-none ring-0"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
             >
                 <ImageGenNode node={node} onUpdate={handleNodeUpdate} />
             </div>

             <Port type="target" position="left" nodeId={node.id} onDown={(e) => onPortDown(e, node.id, 'target')} />
             <Port type="source" position="right" nodeId={node.id} onDown={(e) => onPortDown(e, node.id, 'source')} />
        </div>
      );
  }

  // --- 3. Generic Generator Mode Renderer (Text, Video, Audio) ---
  // (Keeping existing logic for other types but cleaning selection style)

  const renderTopContent = () => {
    switch (node.type) {
      case 'text':
        return (
          <>
            <div className="flex items-center gap-2 mb-3">
              <Badge label="Text" icon={<TypeIcon size={10} />} color="blue" />
            </div>
            <div className="space-y-1.5">
              <SuggestionItem icon="✎" text="自己编写内容" />
              <SuggestionItem icon="🎥" text="文字生视频" />
              <SuggestionItem icon="🎨" text="图片反推提示词" />
            </div>
          </>
        );
      case 'video':
        return (
          <>
             <div className="flex items-center gap-2 mb-3">
              <Badge label="Video" icon={<VideoIcon size={10} />} color="blue" />
            </div>
            <div className="space-y-1.5">
                <SuggestionItem icon="🎞️" text="首尾帧生成视频" />
                <SuggestionItem icon="✨" text="视频风格化" />
            </div>
          </>
        );
      case 'audio':
        return (
          <>
             <div className="flex items-center gap-2 mb-3">
              <Badge label="Audio" icon={<Music size={10} />} color="purple" />
            </div>
             {node.content ? (
                <div className="rounded-lg overflow-hidden mb-2 bg-black/20 border border-white/5 p-2">
                    <audio src={node.content} controls className="w-full h-8" onPointerDown={(e) => e.stopPropagation()} />
                </div>
             ) : (
                <div className="space-y-1.5">
                    <SuggestionItem icon="🎵" text="文字生音乐" />
                    <SuggestionItem icon="🎤" text="人声克隆" />
                </div>
             )}
          </>
        );
      default:
        return null;
    }
  };

  const renderBottomContent = () => {
    switch (node.type) {
      case 'text':
        return (
          <>
            <textarea 
              className="w-full h-24 bg-[#111] border border-[#333] rounded-lg p-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-white/20 resize-none mb-3"
              placeholder="描述内容..."
              defaultValue={node.content}
              onPointerDown={(e) => e.stopPropagation()}
            />
            <FooterBar modelName="Gemini 3 Pro" modelIcon="G" params={["1x"]} cost={4} />
          </>
        );
      case 'video':
        return (
          <>
            <div className="inline-flex items-center px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 text-[10px] border border-purple-500/20 mb-2">
                文生视频
            </div>
            <textarea 
              className="w-full h-16 bg-[#111] border border-[#333] rounded-lg p-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-white/20 resize-none mb-3"
              placeholder="描述视频内容..."
              onPointerDown={(e) => e.stopPropagation()}
            />
            <FooterBar modelName="即梦1.5 Pro" modelIcon="J" params={["16:9", "5s", "480p"]} cost={11} />
          </>
        );
      case 'audio':
        return (
          <>
             <div className="flex items-center gap-2 mb-2">
                <label className="flex items-center gap-2 text-[10px] text-gray-400 cursor-pointer select-none">
                    <input type="checkbox" className="rounded bg-[#333] border-gray-600" />
                    纯音乐 (Instrumental)
                </label>
            </div>
            <textarea 
              className="w-full h-16 bg-[#111] border border-[#333] rounded-lg p-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-white/20 resize-none mb-3"
              placeholder="描述音乐风格..."
              onPointerDown={(e) => e.stopPropagation()}
            />
            <FooterBar modelName="Suno v3.5" modelIcon="S" params={["2min"]} cost={10} />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div
      ref={cardRef}
      className={`node-card absolute w-[320px] transition-all duration-200 select-none group flex flex-col pointer-events-auto outline-none ring-0`}
      style={{
        transform: `translate(${node.position.x}px, ${node.position.y}px)`,
        zIndex: node.selected ? 20 : 1,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id);
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {dragState && (
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-mono px-2 py-1 rounded shadow-lg pointer-events-none z-50 whitespace-nowrap animate-in fade-in zoom-in-95 duration-75">
              X: {Math.round(node.position.x)} Y: {Math.round(node.position.y)}
          </div>
      )}

      <Port type="target" position="left" nodeId={node.id} onDown={(e) => onPortDown(e, node.id, 'target')} />
      <Port type="source" position="right" nodeId={node.id} onDown={(e) => onPortDown(e, node.id, 'source')} />

      <div 
        className={`bg-[#1e1e1e] p-4 rounded-t-xl border border-[#333] cursor-grab active:cursor-grabbing relative z-10 outline-none ring-0
          ${!node.selected ? 'rounded-b-xl shadow-lg' : 'border-b-0'}
          ${node.selected ? 'border-white/20' : 'hover:border-[#555]'}
        `}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <button 
          onPointerDown={(e) => e.stopPropagation()} 
          onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
          className="absolute top-3 right-3 text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 z-50"
        >
          <X size={14} />
        </button>

        {renderTopContent()}
      </div>

      {node.selected && (
        <div className="bg-[#252525] p-3 rounded-b-xl border border-t-0 border-white/20 shadow-2xl animate-in slide-in-from-top-2 duration-200 origin-top">
          {renderBottomContent()}
        </div>
      )}
    </div>
  );
};

// --- Sub Components ---

const Port = ({ type, position, nodeId, onDown }: { type: 'source'|'target', position: 'left'|'right', nodeId: string, onDown: (e: React.PointerEvent) => void }) => {
    const isRight = position === 'right';
    return (
        <div 
            className="
                port absolute
                !w-5 !h-5
                !bg-zinc-800
                !border !border-white/20
                !rounded-full
                flex items-center justify-center
                z-50
                transition-opacity duration-300
                opacity-0 group-hover:opacity-100
                cursor-crosshair
                hover:border-blue-500 hover:text-white
                shadow-md
            "
            style={{
                [isRight ? 'right' : 'left']: '-10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: '#27272a'
            }}
            onPointerDown={onDown}
            data-node-id={nodeId}
            data-type={type}
        >
             <Plus size={10} className="text-zinc-400 pointer-events-none" />
        </div>
    );
};

const Badge = ({ label, icon, color }: { label: string, icon: React.ReactNode, color: string }) => (
  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-${color}-500/10 border border-${color}-500/20 text-${color}-400 text-xs font-semibold`}>
    {icon}
    <span>{label}</span>
  </div>
);

const SuggestionItem = ({ icon, text }: { icon: string, text: string }) => (
  <div className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-200 cursor-pointer p-1 rounded hover:bg-white/5 transition-colors">
    <span className="w-4 text-center opacity-70">{icon}</span>
    <span>{text}</span>
  </div>
);

const FooterBar = ({ modelName, modelIcon, params, cost }: { modelName: string, modelIcon: string, params: string[], cost: number }) => (
  <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
    <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 opacity-80 hover:opacity-100 cursor-pointer transition-opacity">
            <span className="w-4 h-4 rounded-sm bg-white/10 flex items-center justify-center text-[8px]">{modelIcon}</span>
            <span className="text-[10px] text-gray-300 font-medium">{modelName}</span>
        </div>
        <div className="flex items-center gap-2 border-l border-white/10 pl-3">
            {params.map((p, i) => (
                <span key={i} className={`text-[10px] ${p.includes('禁用') || p.includes('控制') ? 'text-gray-600 line-through' : 'text-gray-400'}`}>{p}</span>
            ))}
        </div>
    </div>
    
    <button className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-gray-200 text-black rounded-full text-xs font-bold transition-all active:scale-95 shadow-lg shadow-white/5">
        <span>生成</span>
        <span className="text-[10px] opacity-60">({cost})</span>
    </button>
  </div>
);