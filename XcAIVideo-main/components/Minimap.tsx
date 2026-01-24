import React, { useRef, useState, useEffect, useMemo } from 'react';
import { NodeData, Position } from '../types';

interface MinimapProps {
  nodes: NodeData[];
  scale: number;
  offset: Position;
  viewportSize: { width: number; height: number };
  onNavigate: (newOffset: Position) => void;
  onClose: () => void;
}

export const Minimap: React.FC<MinimapProps> = ({ 
  nodes, 
  scale, 
  offset, 
  viewportSize, 
  onNavigate,
  onClose 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Constants
  const MINIMAP_WIDTH = 240;
  const MINIMAP_HEIGHT = 160;
  const PADDING = 100; // Canvas units padding around content

  // 1. Calculate the "World" bounds (Union of Nodes + Current Viewport)
  const bounds = useMemo(() => {
    // Current Viewport in Canvas Coordinates
    const viewX = -offset.x / scale;
    const viewY = -offset.y / scale;
    const viewW = viewportSize.width / scale;
    const viewH = viewportSize.height / scale;

    let minX = viewX;
    let minY = viewY;
    let maxX = viewX + viewW;
    let maxY = viewY + viewH;

    // Expand to include all nodes
    nodes.forEach(node => {
        const nodeW = 320; // Approx node width
        const nodeH = 200; // Approx node height
        minX = Math.min(minX, node.position.x);
        minY = Math.min(minY, node.position.y);
        maxX = Math.max(maxX, node.position.x + nodeW);
        maxY = Math.max(maxY, node.position.y + nodeH);
    });

    // Add padding
    minX -= PADDING;
    minY -= PADDING;
    maxX += PADDING;
    maxY += PADDING;

    return {
        x: minX,
        y: minY,
        w: maxX - minX,
        h: maxY - minY
    };
  }, [nodes, scale, offset, viewportSize]);

  // 2. Calculate conversion ratio to fit World into Minimap Container
  const mapScale = Math.min(
    MINIMAP_WIDTH / bounds.w,
    MINIMAP_HEIGHT / bounds.h
  );

  // Center the map content in the container if aspect ratios differ
  const offsetX = (MINIMAP_WIDTH - bounds.w * mapScale) / 2;
  const offsetY = (MINIMAP_HEIGHT - bounds.h * mapScale) / 2;

  // Helper: Canvas Coord -> Minimap Coord
  const toMapX = (val: number) => (val - bounds.x) * mapScale + offsetX;
  const toMapY = (val: number) => (val - bounds.y) * mapScale + offsetY;

  // Helper: Minimap Coord -> Canvas Coord (for interaction)
  // Note: We need to invert the logic: val = (mapVal - offset) / mapScale + bounds.x
  
  // Current Viewport Rect for rendering
  const viewportRect = {
    x: toMapX(-offset.x / scale),
    y: toMapY(-offset.y / scale),
    w: (viewportSize.width / scale) * mapScale,
    h: (viewportSize.height / scale) * mapScale
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Check if clicked inside the viewport rect
    const isInsideViewport = 
        clickX >= viewportRect.x && 
        clickX <= viewportRect.x + viewportRect.w &&
        clickY >= viewportRect.y && 
        clickY <= viewportRect.y + viewportRect.h;

    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);

    if (!isInsideViewport) {
        // If clicked outside, jump to that position immediately (center view on click)
        updateOffsetFromMinimap(clickX, clickY);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    e.stopPropagation();
    e.preventDefault();
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    updateOffsetFromMinimap(x, y);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const updateOffsetFromMinimap = (mapX: number, mapY: number) => {
      // Calculate center relative to world bounds
      // mapX = (canvasX - bounds.x) * mapScale + offsetX
      // canvasX = (mapX - offsetX) / mapScale + bounds.x
      
      const targetCenterX = (mapX - offsetX) / mapScale + bounds.x;
      const targetCenterY = (mapY - offsetY) / mapScale + bounds.y;

      // We want to center the viewport on this point
      // New Offset X = -(TargetCenter - ViewWidth/2) * Scale
      const viewW = viewportSize.width / scale;
      const viewH = viewportSize.height / scale;

      const newCanvasX = targetCenterX - viewW / 2;
      const newCanvasY = targetCenterY - viewH / 2;

      onNavigate({
          x: -newCanvasX * scale,
          y: -newCanvasY * scale
      });
  };

  // Close when clicking outside logic is handled by parent or overlay if needed,
  // but here we just render the box.

  return (
    <div 
        className="fixed bottom-20 left-6 z-[60] bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl overflow-hidden select-none animate-in fade-in slide-in-from-bottom-4 duration-200"
        style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
    >
        {/* Background Grid/Noise (Optional) */}
        <div className="absolute inset-0 opacity-20 pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(#555 1px, transparent 1px)', backgroundSize: '10px 10px' }}>
        </div>

        {/* Nodes */}
        {nodes.map(node => {
            const mx = toMapX(node.position.x);
            const my = toMapY(node.position.y);
            const mw = 320 * mapScale;
            const mh = 200 * mapScale; // Simplified height

            return (
                <div 
                    key={node.id}
                    className={`absolute rounded-sm ${node.selected ? 'bg-blue-500' : 'bg-[#444]'}`}
                    style={{
                        left: mx,
                        top: my,
                        width: mw,
                        height: mh
                    }}
                />
            );
        })}

        {/* Viewport Indicator */}
        <div 
            className="absolute border-2 border-blue-400 bg-blue-500/10 cursor-move rounded-sm transition-transform duration-75 ease-out"
            style={{
                left: viewportRect.x,
                top: viewportRect.y,
                width: viewportRect.w,
                height: viewportRect.h
            }}
        />
    </div>
  );
};