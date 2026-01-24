import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { InfiniteCanvas } from './components/InfiniteCanvas';
import { BottomBar } from './components/BottomBar';
import { LeftSidebar } from './components/LeftSidebar';
import { CentralPrompt } from './components/CentralPrompt';
import { TopBar } from './components/TopBar';
import { AgentBar } from './components/AgentBar';
import { ContextMenu } from './components/ContextMenu';
import { SelectionToolbar } from './components/SelectionToolbar';
import { ImageToolbar } from './components/ImageToolbar';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { QuickAddMenu } from './components/QuickAddMenu';
import { ConnectionMenu } from './components/ConnectionMenu';
import { Minimap } from './components/Minimap';
import { HomeDashboard } from './components/HomeDashboard';
import { WorkspaceDashboard } from './components/WorkspaceDashboard';
import { INITIAL_SCALE, INITIAL_OFFSET, MIN_SCALE, MAX_SCALE } from './constants';
import { Position, NodeData, Connection, NodeType } from './types';

// Mock Data Initialization
const INITIAL_NODES: NodeData[] = [];
const INITIAL_CONNECTIONS: Connection[] = [];

// History State Interface
interface HistoryState {
  nodes: NodeData[];
  connections: Connection[];
}

const App: React.FC = () => {
  // Routing
  const [view, setView] = useState<'home' | 'workspace' | 'canvas'>('home');

  // Canvas State
  const [scale, setScale] = useState<number>(INITIAL_SCALE);
  const [offset, setOffset] = useState<Position>(INITIAL_OFFSET);
  const [viewportSize, setViewportSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  
  // Data State
  const [nodes, setNodes] = useState<NodeData[]>(INITIAL_NODES);
  const [connections, setConnections] = useState<Connection[]>(INITIAL_CONNECTIONS);
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false); // For pan mode

  // History State
  const [history, setHistory] = useState<HistoryState[]>([{ nodes: INITIAL_NODES, connections: INITIAL_CONNECTIONS }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Clipboard State
  const [internalClipboard, setInternalClipboard] = useState<NodeData[]>([]);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const clickPositionRef = useRef<Position | null>(null); // Store context menu position

  // UI Toggles
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    canvasPos: Position;
  } | null>(null);

  const [quickAddMenu, setQuickAddMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    canvasPos: Position;
  } | null>(null);

  const [connectionMenu, setConnectionMenu] = useState<{
      visible: boolean;
      x: number;
      y: number;
      sourceNodeId: string;
      sourceType: 'source' | 'target';
  } | null>(null);

  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showMinimap, setShowMinimap] = useState(false);

  // Handle Resize
  useEffect(() => {
      const handleResize = () => {
          setViewportSize({ width: window.innerWidth, height: window.innerHeight });
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Derived State
  const selectedNodes = useMemo(() => nodes.filter(n => n.selected), [nodes]);
  
  const selectionToolbarPos = useMemo(() => {
    if (selectedNodes.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedNodes.forEach(node => {
        minX = Math.min(minX, node.position.x);
        minY = Math.min(minY, node.position.y);
        maxX = Math.max(maxX, node.position.x + (node.width || 320)); 
        maxY = Math.max(maxY, node.position.y + (node.height || 200)); 
    });

    const centerX = (minX + maxX) / 2;
    const minYPos = minY;

    return {
        x: centerX * scale + offset.x,
        y: minYPos * scale + offset.y
    };
  }, [selectedNodes, scale, offset]);

  // --- History Management ---

  const recordHistory = useCallback((newNodes: NodeData[], newConnections: Connection[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ nodes: newNodes, connections: newConnections });
    
    // Limit history size to 50
    if (newHistory.length > 50) newHistory.shift();
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const prevState = history[prevIndex];
      setNodes(prevState.nodes);
      setConnections(prevState.connections);
      setHistoryIndex(prevIndex);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const nextState = history[nextIndex];
      setNodes(nextState.nodes);
      setConnections(nextState.connections);
      setHistoryIndex(nextIndex);
    }
  }, [history, historyIndex]);

  const handleScaleChange = useCallback((newScale: number) => {
    const clamped = Math.min(Math.max(newScale, MIN_SCALE), MAX_SCALE);
    setScale(clamped);
  }, []);

  const handleDeleteSelected = useCallback(() => {
    // 1. Identify selected nodes and selected connections
    const selectedNodeIds = new Set(nodes.filter(n => n.selected).map(n => n.id));
    const selectedConnectionIds = new Set(connections.filter(c => c.selected).map(c => c.id));

    if (selectedNodeIds.size === 0 && selectedConnectionIds.size === 0) return;

    // 2. Filter nodes: Remove if selected
    const newNodes = nodes.filter(n => !selectedNodeIds.has(n.id));

    // 3. Filter connections: Remove if selected OR if attached to a deleted node
    const newConnections = connections.filter(c => {
        const isAttachedToDeletedNode = selectedNodeIds.has(c.fromNodeId) || selectedNodeIds.has(c.toNodeId);
        const isSelected = selectedConnectionIds.has(c.id);
        return !isAttachedToDeletedNode && !isSelected;
    });

    setNodes(newNodes);
    setConnections(newConnections);
    recordHistory(newNodes, newConnections);
  }, [nodes, connections, recordHistory]);

  const handleSelectAll = useCallback(() => {
      setNodes(prev => prev.map(n => ({...n, selected: true})));
      setConnections(prev => prev.map(c => ({...c, selected: true})));
  }, []);

  const handlePaste = useCallback(async (position: Position) => {
    let newNodesToAdd: NodeData[] = [];

    // 1. Internal Clipboard
    if (internalClipboard.length > 0) {
        const refNode = internalClipboard[0];
        const dx = position.x - refNode.position.x;
        const dy = position.y - refNode.position.y;

        newNodesToAdd = internalClipboard.map(n => ({
            ...n,
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            position: { x: n.position.x + dx, y: n.position.y + dy },
            selected: true
        }));
    } else {
        // 2. System Clipboard
        try {
            const clipboardItems = await navigator.clipboard.read();
            for (const item of clipboardItems) {
                if (item.types.some(type => type.startsWith('image/'))) {
                    const blob = await item.getType(item.types.find(type => type.startsWith('image/'))!);
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const imgNode: NodeData = {
                            id: Date.now().toString(),
                            type: 'image',
                            title: 'Pasted Image',
                            position: position,
                            content: e.target?.result as string,
                            selected: true
                        };
                        const updatedNodes = (nodes.map(n => ({...n, selected: false})) as NodeData[]).concat(imgNode);
                        setNodes(updatedNodes);
                        recordHistory(updatedNodes, connections);
                    };
                    reader.readAsDataURL(blob);
                    return;
                }
            }
            const text = await navigator.clipboard.readText();
            if (text) {
                newNodesToAdd.push({
                    id: Date.now().toString(),
                    type: 'text',
                    title: 'Text',
                    position: position,
                    content: text,
                    selected: true
                });
            }
        } catch (err) {
            console.warn("Clipboard read failed or permission denied", err);
        }
    }

    if (newNodesToAdd.length > 0) {
        const updatedNodes = (nodes.map(n => ({...n, selected: false})) as NodeData[]).concat(newNodesToAdd);
        setNodes(updatedNodes);
        recordHistory(updatedNodes, connections);
    }
  }, [internalClipboard, nodes, connections, recordHistory]);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (view !== 'canvas') return;

        // Ignore inputs if focused on text fields
        const target = e.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

        // Spacebar Panning (allow even if input focused? Usually no, but standard is no)
        if (e.code === 'Space' && !e.repeat && !isInput) {
             e.preventDefault(); 
             setIsSpacePressed(true);
        }

        // --- Modals / Actions ---

        // Undo: Ctrl+Z
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            handleUndo();
        }
        // Redo: Ctrl+Y or Ctrl+Shift+Z
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
            e.preventDefault();
            handleRedo();
        }
        // Copy: Ctrl+C
        if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !isInput) {
             const selected = nodes.filter(n => n.selected);
             if (selected.length > 0) {
                 setInternalClipboard(selected);
             }
        }
        // Paste: Ctrl+V
        if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !isInput) {
             const centerX = (-offset.x + window.innerWidth / 2) / scale;
             const centerY = (-offset.y + window.innerHeight / 2) / scale;
             handlePaste({ x: centerX, y: centerY });
        }
        // Delete: Del or Backspace
        if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput) {
            handleDeleteSelected();
        }
        // Select All: Ctrl+A
        if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !isInput) {
            e.preventDefault();
            handleSelectAll();
        }

        // --- Zoom ---
        // Ctrl + +/=
        if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
            e.preventDefault();
            handleScaleChange(scale + 0.1);
        }
        // Ctrl + -
        if ((e.ctrlKey || e.metaKey) && e.key === '-') {
            e.preventDefault();
            handleScaleChange(scale - 0.1);
        }
        // Ctrl + 0 (Reset)
        if ((e.ctrlKey || e.metaKey) && e.key === '0') {
            e.preventDefault();
            handleScaleChange(1.0);
            setOffset(INITIAL_OFFSET);
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
  }, [
    nodes, connections, history, historyIndex, view, offset, scale, internalClipboard, 
    handleUndo, handleRedo, handlePaste, handleDeleteSelected, handleScaleChange, handleSelectAll
  ]);


  // --- Node Actions ---

  const handleReset = () => {
    setScale(INITIAL_SCALE);
    setOffset(INITIAL_OFFSET);
  };

  const handleAddNode = (position?: Position, type: NodeType = 'text', content?: string) => {
    const pos = position || { 
      x: -offset.x / scale + window.innerWidth / (2 * scale) - 160, 
      y: -offset.y / scale + window.innerHeight / (2 * scale) - 100 
    };

    const newNode: NodeData = {
      id: Date.now().toString(),
      type: type,
      title: type.charAt(0).toUpperCase() + type.slice(1),
      position: pos,
      selected: true,
      content: content || ''
    };
    
    // Auto-return the new node ID
    const newNodes = [...nodes.map(n => ({ ...n, selected: false })), newNode];
    setNodes(newNodes);
    recordHistory(newNodes, connections);
    setContextMenu(null);
    setQuickAddMenu(null); // Close quick menu if open
    return newNode.id;
  };

  const handleAddAsset = (position: Position) => {
      // Simulate adding an asset with content
      handleAddNode(position, 'image', 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop');
  };

  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>, nodeIdToUpdate?: string) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (nodeIdToUpdate) {
          // Update existing node content
           const reader = new FileReader();
           reader.onload = (ev) => {
              const result = ev.target?.result as string;
              setNodes(prev => prev.map(n => n.id === nodeIdToUpdate ? { ...n, content: result } : n));
           };
           reader.readAsDataURL(file);
           if (fileInputRef.current) fileInputRef.current.value = '';
           return;
      }

      // Use the stored click position (from context menu OR quick add menu), or fall back to center
      const pos = clickPositionRef.current || {
         x: -offset.x / scale + window.innerWidth / (2 * scale) - 160, 
         y: -offset.y / scale + window.innerHeight / (2 * scale) - 100 
      };

      if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (ev) => {
              handleAddNode(pos, 'image', ev.target?.result as string);
          };
          reader.readAsDataURL(file);
      } else if (file.type.startsWith('video/')) {
          const url = URL.createObjectURL(file);
          handleAddNode(pos, 'video', url); 
      } else if (file.type.startsWith('audio/')) {
          const url = URL.createObjectURL(file);
          handleAddNode(pos, 'audio', url);
      } else if (file.type.startsWith('text/')) {
          const reader = new FileReader();
          reader.onload = (ev) => {
              handleAddNode(pos, 'text', ev.target?.result as string);
          };
          reader.readAsText(file);
      } else {
          handleAddNode(pos, 'text', `File: ${file.name}`);
      }

      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteNode = (id: string) => {
    const newNodes = nodes.filter(n => n.id !== id);
    const newConnections = connections.filter(c => c.fromNodeId !== id && c.toNodeId !== id);
    setNodes(newNodes);
    setConnections(newConnections);
    recordHistory(newNodes, newConnections);
  };

  const handleSelectNode = (id: string | null) => {
    setNodes(prev => prev.map(n => ({
      ...n,
      selected: n.id === id
    })));
    // Deselect connections when selecting a node (standard behavior)
    setConnections(prev => prev.map(c => ({...c, selected: false})));
  };

  const handleSelectConnection = (id: string | null) => {
      setConnections(prev => prev.map(c => ({
          ...c,
          selected: c.id === id
      })));
      // Deselect nodes when selecting a connection
      setNodes(prev => prev.map(n => ({...n, selected: false})));
  };

  const handleMultiSelect = (ids: string[]) => {
    const idSet = new Set(ids);
    setNodes(prev => prev.map(n => ({
        ...n,
        selected: idSet.has(n.id)
    })));
    // Keep connection selections as is, or deselect? Standard is deselect when box selecting nodes.
    setConnections(prev => prev.map(c => ({...c, selected: false})));
  };

  const handleNodeMove = (id: string, newPos: Position) => {
    setNodes(prev => prev.map(n => 
      n.id === id ? { ...n, position: newPos } : n
    ));
  };
  
  const handleNodeResize = (id: string, size: { width: number, height: number }) => {
      // Avoid excessive updates
      setNodes(prev => {
          const node = prev.find(n => n.id === id);
          if (node && (node.width !== size.width || node.height !== size.height)) {
              return prev.map(n => n.id === id ? { ...n, width: size.width, height: size.height } : n);
          }
          return prev;
      });
  };

  const handleNodeDragEnd = () => {
      setIsDraggingNode(false);
      recordHistory(nodes, connections);
  }

  const handleConnect = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    if (connections.find(c => c.fromNodeId === fromId && c.toNodeId === toId)) return;
    
    const newConn = {
      id: `c-${Date.now()}`,
      fromNodeId: fromId,
      toNodeId: toId,
      selected: false
    };
    const newConnections = [...connections, newConn];
    setConnections(newConnections);
    recordHistory(nodes, newConnections);
  };

  const handleShowContextMenu = (screenPos: Position, canvasPos: Position) => {
    // Save the canvas position in ref so upload can use it even after menu closes
    clickPositionRef.current = canvasPos;
    setContextMenu({
      visible: true,
      x: screenPos.x,
      y: screenPos.y,
      canvasPos: canvasPos
    });
    setQuickAddMenu(null);
  };

  const handleShowQuickMenu = (screenPos: Position, canvasPos: Position) => {
    clickPositionRef.current = canvasPos; // Update for upload action from quick menu
    setQuickAddMenu({
        visible: true,
        x: screenPos.x,
        y: screenPos.y,
        canvasPos: canvasPos
    });
    setContextMenu(null);
  };

  const handleConnectionDragStop = (screenPos: Position, sourceNodeId: string, sourceType: 'source' | 'target') => {
      setConnectionMenu({
          visible: true,
          x: screenPos.x,
          y: screenPos.y,
          sourceNodeId,
          sourceType
      });
  };

  const handleAddNodeFromConnection = (type: NodeType) => {
      if (!connectionMenu) return;

      const { x, y, sourceNodeId, sourceType } = connectionMenu;
      
      let canvasX = (x - offset.x) / scale;
      let canvasY = (y - offset.y) / scale;

      // Smart Positioning: 
      // If clicking (or very short drag), position the node intelligently relative to source
      const sourceNode = nodes.find(n => n.id === sourceNodeId);
      if (sourceNode) {
          const nodeW = sourceNode.width || 320;
          
          // Rough distance check
          const sourcePortX = sourceNode.position.x + nodeW;
          const sourcePortY = sourceNode.position.y + 40;
          const dist = Math.hypot(canvasX - sourcePortX, canvasY - sourcePortY);
          
          // If distance is small (< 50px), assume it was a click
          if (dist < 50) {
              if (sourceType === 'source') {
                  canvasX = sourceNode.position.x + nodeW + 100;
                  canvasY = sourceNode.position.y;
              } else {
                  canvasX = sourceNode.position.x - 320 - 100;
                  canvasY = sourceNode.position.y;
              }
          }
      }
      
      const newNodeId = handleAddNode({ x: canvasX, y: canvasY }, type);
      
      if (newNodeId) {
          if (sourceType === 'source') {
              // Dragged from Source -> New Node (Target)
              handleConnect(sourceNodeId, newNodeId);
          } else {
              // Dragged from Target (Backwards) -> New Node (Source)
              handleConnect(newNodeId, sourceNodeId);
          }
      }

      setConnectionMenu(null);
  };

  // --- Render ---

  if (view === 'home') {
    return (
      <HomeDashboard 
        onNavigate={(page) => setView(page)} 
        onCreateProject={() => setView('canvas')} 
      />
    );
  }

  if (view === 'workspace') {
    return (
      <WorkspaceDashboard 
        onNavigate={(page) => setView(page)} 
        onOpenProject={() => setView('canvas')}
      />
    );
  }

  return (
    <div className="w-screen h-screen relative bg-[#050505] overflow-hidden text-gray-200">
      
      {/* Hidden File Input for Upload */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        onChange={handleUploadFile} 
        accept="image/*,video/*,audio/*,text/*"
      />

      <InfiniteCanvas 
        scale={scale} 
        offset={offset} 
        nodes={nodes}
        connections={connections}
        isSpacePressed={isSpacePressed}
        onOffsetChange={setOffset} 
        onScaleChange={handleScaleChange}
        onShowContextMenu={handleShowContextMenu}
        onDeleteNode={handleDeleteNode}
        onSelectNode={handleSelectNode}
        onSelectConnection={handleSelectConnection}
        onMultiSelect={handleMultiSelect}
        onNodeMove={handleNodeMove}
        onNodeDragStart={() => setIsDraggingNode(true)}
        onNodeDragEnd={handleNodeDragEnd}
        onConnect={handleConnect}
        onCanvasDoubleClick={(screenPos) => {
            const canvasX = (screenPos.x - offset.x) / scale;
            const canvasY = (screenPos.y - offset.y) / scale;
            handleShowQuickMenu(screenPos, {x: canvasX, y: canvasY});
        }}
        onConnectionDragStop={handleConnectionDragStop}
        onUpload={(nodeId) => {
             // Hacky way to store target node ID for upload. 
             (fileInputRef.current as any).targetNodeId = nodeId; 
             fileInputRef.current?.click();
        }}
        onNodeResize={handleNodeResize}
      />
      
      <TopBar onBack={() => setView('home')} />
      <LeftSidebar onAddNode={(type) => handleAddNode(undefined, type)} />

      {nodes.length === 0 && <CentralPrompt />}

      {/* Floating Elements Container (Bottom Left) */}
      <div className="absolute bottom-6 left-6 z-50 flex flex-col gap-3 items-start">
        {showMinimap && (
            <Minimap 
                nodes={nodes}
                scale={scale}
                offset={offset}
                viewportSize={viewportSize}
                onNavigate={setOffset}
                onClose={() => setShowMinimap(false)}
            />
        )}

        <BottomBar 
          scale={scale} 
          onScaleChange={handleScaleChange} 
          onReset={handleReset} 
          onShowShortcuts={() => setShowShortcuts(true)}
          showMinimap={showMinimap}
          onToggleMinimap={() => setShowMinimap(!showMinimap)}
        />
      </div>

      <AgentBar isDraggingNode={isDraggingNode} />

      {/* Right Click Menu */}
      {contextMenu?.visible && (
        <ContextMenu 
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onSelect={(type) => handleAddNode(contextMenu.canvasPos, type)}
          onUpload={() => {
              (fileInputRef.current as any).targetNodeId = null; // Clear target
              fileInputRef.current?.click();
          }}
          onAddAsset={() => handleAddAsset(contextMenu.canvasPos)}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onPaste={() => handlePaste(contextMenu.canvasPos)}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < history.length - 1}
        />
      )}

      {/* Quick Add Menu (Double Click) */}
      {quickAddMenu?.visible && (
        <QuickAddMenu 
           x={quickAddMenu.x}
           y={quickAddMenu.y}
           onClose={() => setQuickAddMenu(null)}
           onSelect={(type) => {
               // Center the node at the clicked position
               const pos = { x: quickAddMenu.canvasPos.x - 160, y: quickAddMenu.canvasPos.y - 50 };
               handleAddNode(pos, type);
           }}
           onUpload={() => {
               (fileInputRef.current as any).targetNodeId = null;
               fileInputRef.current?.click();
               setQuickAddMenu(null);
           }}
        />
      )}

      {/* Connection Menu (Drag Drop) */}
      {connectionMenu?.visible && (
          <ConnectionMenu 
            x={connectionMenu.x}
            y={connectionMenu.y}
            type={connectionMenu.sourceType}
            onClose={() => setConnectionMenu(null)}
            onSelect={handleAddNodeFromConnection}
          />
      )}

      {/* Shortcuts Dialog */}
      {showShortcuts && (
        <ShortcutsDialog onClose={() => setShowShortcuts(false)} />
      )}

      {/* Floating Toolbar Logic */}
      {selectedNodes.length === 1 && selectedNodes[0].type === 'image' && selectionToolbarPos ? (
          <ImageToolbar 
            position={selectionToolbarPos}
            onAction={(action) => console.log('Image Action:', action)}
          />
      ) : (
          selectedNodes.length > 0 && selectionToolbarPos && (
             <SelectionToolbar 
                position={selectionToolbarPos}
                count={selectedNodes.length}
                onAddAsset={() => console.log('Saved as Asset')}
                onAddToChat={() => console.log('Added to Chat')}
                onGroup={() => console.log('Grouped')}
                onDelete={handleDeleteSelected}
             />
          )
      )}

      <div className="absolute top-16 right-6 text-white/10 text-[10px] font-mono pointer-events-none select-none">
        Nodes: {nodes.length} | Zoom: {(scale * 100).toFixed(0)}%
      </div>
      
      {/* Override internal input handler to check for target node property */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        onChange={(e) => {
             const targetId = (fileInputRef.current as any).targetNodeId;
             handleUploadFile(e, targetId);
             (fileInputRef.current as any).targetNodeId = null; // Reset
        }} 
        accept="image/*,video/*,audio/*,text/*"
      />
    </div>
  );
};

export default App;