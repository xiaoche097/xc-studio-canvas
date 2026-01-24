import React from 'react';

export interface Position {
  x: number;
  y: number;
}

export interface CanvasState {
  scale: number;
  offset: Position;
}

export interface ToolbarProps {
  scale: number;
  onScaleChange: (newScale: number) => void;
  onReset: () => void;
  onShowShortcuts: () => void;
  showMinimap: boolean; // New
  onToggleMinimap: () => void; // New
}

export type NodeType = 'text' | 'image' | 'video' | 'audio';

export interface NodeData {
  id: string;
  type: NodeType;
  title: string;
  position: Position;
  content?: string;
  selected?: boolean;
  width?: number; // New: Track width for dynamic nodes
  height?: number; // New: Track height for centering ports on dynamic nodes
  data?: Record<string, any>; // New: Store specific node settings (aspectRatio, model, etc.)
}

export interface Connection {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  selected?: boolean;
}

export interface InfiniteCanvasProps {
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
  onNodeResize?: (id: string, size: { width: number; height: number }) => void; // New
}

export interface NodeCardProps {
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
  onResize?: (id: string, size: { width: number; height: number }) => void; // New
}