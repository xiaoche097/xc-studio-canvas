import React, { useRef, useState, useEffect } from 'react';
import { Position, NodeData, Connection } from '../types';
import { GRID_SIZE, MIN_SCALE, MAX_SCALE, ZOOM_SENSITIVITY } from '../constants';
import { NodeCard } from './NodeCard';

interface InfiniteCanvasProps {
  scale: number;
  offset: Position;
  nodes: NodeData[];
  connections: Connection[];
  isSpacePressed: boolean;
  onOffsetChange: (newOffset: Position) => void;
  onScaleChange: (newScale: number) => void;
  onShowContextMenu: (screenPos: Position, canvasPos: Position) => void;
  onDeleteNode: (id: string) => void;
  onSelectNode: (id: string | null) => void;
  onSelectConnection: (id: string | null) => void;
  onMultiSelect: (ids: string[]) => void;
  onNodeMove: (id: string, newPos: Position) => void;
  onNodeDragStart?: () => void;
  onNodeDragEnd?: () => void;
  onConnect: (fromId: string, toId: string) => void;
  onCanvasDoubleClick: (screenPos: Position) => void;
  onConnectionDragStop: (screenPos: Position, sourceNodeId: string, sourceType: 'source' | 'target') => void;
  onUpload?: (nodeId: string) => void; 
  onNodeResize?: (id: string, size: { width: number; height: number }) => void;
}

export const InfiniteCanvas: React.FC<InfiniteCanvasProps> = ({
  scale,
  offset,
  nodes,
  connections,
  isSpacePressed,
  onOffsetChange,
  onScaleChange,
  onShowContextMenu,
  onDeleteNode,
  onSelectNode,
  onSelectConnection,
  onMultiSelect,
  onNodeMove,
  onNodeDragStart,
  onNodeDragEnd,
  onConnect,
  onCanvasDoubleClick,
  onConnectionDragStop,
  onUpload,
  onNodeResize
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Interaction Modes
  const [isPanning, setIsPanning] = useState(false);
  const [isBoxSelecting, setIsBoxSelecting] = useState(false);
  const [hasPanned, setHasPanned] = useState(false); 
  
  const [lastMousePos, setLastMousePos] = useState<Position>({ x: 0, y: 0 });
  const [selectionBox, setSelectionBox] = useState<{ start: Position, current: Position } | null>(null);

  // Connection State
  const [connectionStart, setConnectionStart] = useState<{ nodeId: string, type: 'source' | 'target', pos: Position } | null>(null);
  const [tempConnectionEnd, setTempConnectionEnd] = useState<Position | null>(null);
  const [hoveredPort, setHoveredPort] = useState<{ nodeId: string, type: 'source' | 'target', x: number, y: number } | null>(null);

  // Handle Wheel for Zooming
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY * ZOOM_SENSITIVITY;
      const newScale = Math.min(Math.max(MIN_SCALE, scale + delta), MAX_SCALE);
      onScaleChange(newScale);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [scale, onScaleChange]);

  // Prevent default context menu on container
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    // Ensure we only double click on the canvas background
    if ((e.target as HTMLElement).closest('.node-card') || (e.target as HTMLElement).closest('.port')) return;

    if (e.target === containerRef.current || (e.target as HTMLElement).classList.contains('canvas-layer')) {
        onCanvasDoubleClick({ x: e.clientX, y: e.clientY });
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;

    // Guard: Do not interact if clicking on a node, a port, or any interactive element
    if (target.closest('.node-card') || target.closest('.port')) {
        return;
    }

    containerRef.current?.setPointerCapture(e.pointerId);
    setLastMousePos({ x: e.clientX, y: e.clientY });

    // Panning
    if (e.button === 2 || (e.button === 0 && isSpacePressed)) {
        setIsPanning(true);
        setHasPanned(false);
    } 
    // Box Selection
    else if (e.button === 0 && !connectionStart) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
            const relX = e.clientX - rect.left;
            const relY = e.clientY - rect.top;
            setIsBoxSelecting(true);
            setSelectionBox({ start: { x: relX, y: relY }, current: { x: relX, y: relY } });
        }
        onSelectNode(null); 
        onSelectConnection(null);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Panning
    if (isPanning) {
        const dx = e.clientX - lastMousePos.x;
        const dy = e.clientY - lastMousePos.y;
        
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
            setHasPanned(true);
        }

        onOffsetChange({
            x: offset.x + dx,
            y: offset.y + dy,
        });
        setLastMousePos({ x: e.clientX, y: e.clientY });
    }

    // Box Selection
    if (isBoxSelecting && selectionBox) {
        const relX = e.clientX - rect.left;
        const relY = e.clientY - rect.top;
        setSelectionBox({ ...selectionBox, current: { x: relX, y: relY } });
    }

    // Connection Dragging
    if (connectionStart) {
        const canvasX = (e.clientX - rect.left - offset.x) / scale;
        const canvasY = (e.clientY - rect.top - offset.y) / scale;
        
        // Find Snap Port
        let foundPort = null;
        const HIT_RADIUS = 40 / scale; // Generous hit radius
        const targetType = connectionStart.type === 'source' ? 'target' : 'source';

        for (const node of nodes) {
            if (node.id === connectionStart.nodeId) continue; // Skip self

            const nodeW = node.width || 320;
            const nodeH = node.height || 150;
            
            // Calculate Exact Port Centers for Snapping
            // Target (Left): node.x - 2
            // Source (Right): node.x + w + 2
            const portY = node.position.y + nodeH / 2;
            
            let portX = 0;
            if (targetType === 'target') {
                portX = node.position.x - 2;
            } else {
                portX = node.position.x + nodeW + 2;
            }

            if (Math.hypot(canvasX - portX, canvasY - portY) < HIT_RADIUS) {
                foundPort = { nodeId: node.id, type: targetType, x: portX, y: portY };
                break;
            }
        }

        setHoveredPort(foundPort as any);

        if (foundPort) {
            setTempConnectionEnd({ x: foundPort.x, y: foundPort.y });
        } else {
            setTempConnectionEnd({ x: canvasX, y: canvasY });
        }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    containerRef.current?.releasePointerCapture(e.pointerId);

    if (isPanning) {
        setIsPanning(false);
        if (e.button === 2 && !hasPanned) {
             const rect = containerRef.current?.getBoundingClientRect();
             if (rect) {
                 const canvasX = (e.clientX - rect.left - offset.x) / scale;
                 const canvasY = (e.clientY - rect.top - offset.y) / scale;
                 onShowContextMenu(
                   { x: e.clientX, y: e.clientY }, 
                   { x: canvasX, y: canvasY }
                 );
             }
        }
    }

    if (isBoxSelecting && selectionBox) {
        setIsBoxSelecting(false);
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
            const x1 = Math.min(selectionBox.start.x, selectionBox.current.x);
            const y1 = Math.min(selectionBox.start.y, selectionBox.current.y);
            const x2 = Math.max(selectionBox.start.x, selectionBox.current.x);
            const y2 = Math.max(selectionBox.start.y, selectionBox.current.y);

            const canvasX1 = (x1 - offset.x) / scale;
            const canvasY1 = (y1 - offset.y) / scale;
            const canvasX2 = (x2 - offset.x) / scale;
            const canvasY2 = (y2 - offset.y) / scale;

            const selectedIds = nodes.filter(node => {
                const nodeW = node.width || 320; 
                const nodeH = node.height || 150; 
                return (
                    node.position.x < canvasX2 &&
                    node.position.x + nodeW > canvasX1 &&
                    node.position.y < canvasY2 &&
                    node.position.y + nodeH > canvasY1
                );
            }).map(n => n.id);

            if (selectedIds.length > 0) {
                onMultiSelect(selectedIds);
            }
        }
        setSelectionBox(null);
    }

    if (connectionStart) {
        // Finalize Connection
        if (hoveredPort) {
             if (connectionStart.type === 'source' && hoveredPort.type === 'target') {
                  onConnect(connectionStart.nodeId, hoveredPort.nodeId);
             } else if (connectionStart.type === 'target' && hoveredPort.type === 'source') {
                  onConnect(hoveredPort.nodeId, connectionStart.nodeId);
             }
        } else {
            // Drop in empty space -> Open Connection Menu
            onConnectionDragStop(
                { x: e.clientX, y: e.clientY },
                connectionStart.nodeId,
                connectionStart.type
            );
        }

        setConnectionStart(null);
        setTempConnectionEnd(null);
        setHoveredPort(null);
    }
  };

  const handlePortDown = (e: React.PointerEvent, nodeId: string, type: 'source' | 'target') => {
    e.stopPropagation(); // Stop bubbling to prevent node selection/drag
    e.preventDefault();

    // Critical: Capture pointer on the CONTAINER to track drag globally
    containerRef.current?.setPointerCapture(e.pointerId);

    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    // Precise Center Alignment:
    // Port visuals are w-5 (20px).
    // Left port is -12px relative to node left. Center = -12 + 10 = -2px.
    // Right port is -12px relative to node right. Center = +12 - 10 = +2px (relative to right edge).
    
    const nodeW = node.width || 320;
    const nodeH = node.height || 150;
    
    const startX = type === 'source' ? node.position.x + nodeW + 2 : node.position.x - 2;
    const startY = node.position.y + nodeH / 2;

    setConnectionStart({ nodeId, type, pos: { x: startX, y: startY } });
    setTempConnectionEnd({ x: startX, y: startY });
  };

  // Standard Cubic Bezier Path Algorithm
  // M sx sy C cp1x cp1y, cp2x cp2y, tx ty
  const getSmoothPath = (sx: number, sy: number, tx: number, ty: number) => {
      const dist = Math.abs(sx - tx);
      // Dynamic curvature based on distance, constrained for neatness
      const controlOffset = Math.max(dist * 0.5, 50); 
      
      const cp1x = sx + controlOffset;
      const cp1y = sy;
      const cp2x = tx - controlOffset;
      const cp2y = ty;

      return `M ${sx} ${sy} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${tx} ${ty}`;
  };

  // Dragging Path
  const getDragConnectionPath = (start: Position, end: Position, type: 'source' | 'target') => {
      // PENETRATION OFFSET: Force the line to start "inside" the port visual.
      // Source (Right) -> Penetrate Left (-6px)
      // Target (Left) -> Penetrate Right (+6px)
      
      if (type === 'source') {
          // Dragging from Source (Right) -> Mouse (Target-like)
          return getSmoothPath(start.x - 6, start.y, end.x, end.y);
      } else {
          // Dragging from Target (Left) -> Mouse (Source-like)
          // Start is Target Port. Penetrate Right (+6px)
          return getSmoothPath(end.x, end.y, start.x + 6, start.y);
      }
  };

  // Static Connection Path
  const getExistingConnectionPath = (conn: Connection) => {
    const fromNode = nodes.find(n => n.id === conn.fromNodeId);
    const toNode = nodes.find(n => n.id === conn.toNodeId);
    if (!fromNode || !toNode) return '';

    const fromW = fromNode.width || 320;
    const fromH = fromNode.height || 150;
    const toH = toNode.height || 150;

    // From Source (Right Side)
    // Add offset -6 to penetrate Left into the port
    const startX = fromNode.position.x + fromW + 2 - 6;
    const startY = fromNode.position.y + fromH / 2;

    // To Target (Left Side)
    // Add offset +6 to penetrate Right into the port
    const endX = toNode.position.x - 2 + 6;
    const endY = toNode.position.y + toH / 2;

    return getSmoothPath(startX, startY, endX, endY);
  };

  const gridStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundImage: `radial-gradient(circle, #333 1.5px, transparent 1.5px)`,
    backgroundSize: `${GRID_SIZE * scale}px ${GRID_SIZE * scale}px`,
    backgroundPosition: `${offset.x}px ${offset.y}px`,
    opacity: 0.8,
  };

  let cursorStyle = 'default';
  if (isPanning) cursorStyle = 'grabbing';
  else if (isSpacePressed) cursorStyle = 'grab';

  return (
    <div
      ref={containerRef}
      className={`w-full h-full select-none`}
      style={{ cursor: cursorStyle, touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
    >
      <div style={gridStyle} className="pointer-events-none canvas-layer" />

      {/* Transformed Content */}
      <div
        className="origin-top-left absolute will-change-transform canvas-layer"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
        }}
      >
        {/* Origin Marker */}
        <div className="absolute top-0 left-0 w-0 h-0 pointer-events-none z-0">
            <div className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center opacity-30">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="mt-2 text-[10px] text-blue-500 font-mono whitespace-nowrap">Origin</span>
            </div>
        </div>

        {/* Existing Connections Layer (Z-Index 0) */}
        <svg 
            className="overflow-visible absolute top-0 left-0 pointer-events-none z-0"
            style={{ width: '1px', height: '1px' }}
        >
          {connections.map(conn => (
            <React.Fragment key={conn.id}>
              {/* Invisible Hit Area for Selection */}
              <path
                d={getExistingConnectionPath(conn)}
                fill="none"
                stroke="transparent"
                strokeWidth="20"
                className="cursor-pointer pointer-events-auto"
                onClick={(e) => {
                    e.stopPropagation();
                    onSelectConnection(conn.id);
                }}
              />
              {/* Visible Path */}
              <path
                d={getExistingConnectionPath(conn)}
                fill="none"
                stroke={conn.selected ? "#3b82f6" : "#71717a"} // zinc-500 for normal state
                strokeWidth={conn.selected ? "3" : "2"}
                strokeLinecap="round"
                className={`transition-all pointer-events-none ${conn.selected ? 'opacity-100' : 'opacity-80'}`}
                style={{ filter: conn.selected ? 'drop-shadow(0 0 4px rgba(59, 130, 246, 0.5))' : 'none' }}
              />
            </React.Fragment>
          ))}
        </svg>

        {/* Nodes Layer (Z-Index 1-20) */}
        {nodes.map(node => (
          <NodeCard
            key={node.id}
            node={node}
            scale={scale}
            onDelete={onDeleteNode}
            onSelect={onSelectNode}
            onPositionChange={onNodeMove}
            onDragStart={onNodeDragStart}
            onDragEnd={onNodeDragEnd}
            onPortDown={handlePortDown}
            onAddConnectedNode={() => {}}
            onUpload={() => onUpload?.(node.id)}
            onResize={onNodeResize}
          />
        ))}

        {/* Dragging Connection Layer (Z-Index 0: Below Nodes to hide gap) */}
        {connectionStart && tempConnectionEnd && (
             <svg 
                className="overflow-visible absolute top-0 left-0 pointer-events-none z-[0]"
                style={{ 
                    width: '1px', 
                    height: '1px',
                    overflow: 'visible' 
                }}
             >
                 {/* Drag Line */}
                 <path
                    d={getDragConnectionPath(connectionStart.pos, tempConnectionEnd, connectionStart.type)}
                    fill="none"
                    stroke="#71717a" // zinc-500
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray="5,5"
                    className="opacity-90 drop-shadow-md animate-pulse"
                />
                 {/* Snap Indicator */}
                 {hoveredPort && (
                     <circle 
                        cx={hoveredPort.x} 
                        cy={hoveredPort.y} 
                        r="6" 
                        fill="#3b82f6"
                        className="animate-ping absolute origin-center opacity-50" 
                     />
                 )}
                 {/* Drag Tip */}
                 <circle 
                    cx={tempConnectionEnd.x} 
                    cy={tempConnectionEnd.y} 
                    r="4"
                    fill={hoveredPort ? "#3b82f6" : "#71717a"}
                    className="transition-all"
                 />
             </svg>
        )}
      </div>

      {/* Box Selection Overlay */}
      {isBoxSelecting && selectionBox && (
          <div 
            className="absolute border border-blue-500 bg-blue-500/10 pointer-events-none z-50"
            style={{
                left: Math.min(selectionBox.start.x, selectionBox.current.x),
                top: Math.min(selectionBox.start.y, selectionBox.current.y),
                width: Math.abs(selectionBox.current.x - selectionBox.start.x),
                height: Math.abs(selectionBox.current.y - selectionBox.start.y),
            }}
          />
      )}
    </div>
  );
};