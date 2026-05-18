
import React, { useState, useRef, useEffect } from 'react';
import { 
    Plus, RotateCcw, History, MessageSquare, FolderHeart, X, 
    ImageIcon, Video as VideoIcon, Film, Save, FolderPlus, 
    Edit, Trash2, Box, ScanFace, Brush, Type, Workflow as WorkflowIcon,
    Clapperboard, Mic2, Settings, Globe, Layers, Upload, Volume2
} from 'lucide-react';
import { NodeType, Workflow } from '../types';

interface SidebarDockProps {
    onAddNode: (type: NodeType) => void;
    onUndo: () => void;
    isChatOpen: boolean;
    onToggleChat: () => void;
    
    // Smart Sequence (ex-MultiFrame)
    isMultiFrameOpen: boolean;
    onToggleMultiFrame: () => void;
    
    // Sonic Studio (Music)
    isSonicStudioOpen?: boolean;
    onToggleSonicStudio?: () => void;
    
    // History Props
    assetHistory: any[];
    onHistoryItemClick: (item: any) => void;
    onDeleteAsset: (id: string) => void;
    
    // Workflow Props
    workflows: Workflow[];
    selectedWorkflowId: string | null;
    onSelectWorkflow: (id: string | null) => void;
    onSaveWorkflow: () => void;
    onDeleteWorkflow: (id: string) => void;
    onRenameWorkflow: (id: string, title: string) => void;

    // Settings
    onOpenSettings: () => void;

    // Controlled activePanel state
    activePanel: 'history' | 'workflow' | 'add' | null;
    onChangeActivePanel: (panel: 'history' | 'workflow' | 'add' | null) => void;
}

// Helper Helpers
const getNodeNameCN = (t: string) => {
    switch(t) {
        case NodeType.PROMPT_INPUT: return '创意描述';
        case NodeType.IMAGE_GENERATOR: return '文字生图';
        case NodeType.VIDEO_GENERATOR: return '文生视频';
        case NodeType.AUDIO_GENERATOR: return '灵感音乐';
        case NodeType.VIDEO_ANALYZER: return '视频分析';
        case NodeType.IMAGE_EDITOR: return '图像编辑';
        default: return t;
    }
};

const getNodeIcon = (t: string) => {
    switch(t) {
        case NodeType.PROMPT_INPUT: return Type;
        case NodeType.IMAGE_GENERATOR: return ImageIcon;
        case NodeType.VIDEO_GENERATOR: return Film;
        case NodeType.AUDIO_GENERATOR: return Mic2;
        case NodeType.VIDEO_ANALYZER: return ScanFace;
        case NodeType.IMAGE_EDITOR: return Brush;
        default: return Plus;
    }
};

const SPRING = "cubic-bezier(0.32, 0.72, 0, 1)";

export const SidebarDock: React.FC<SidebarDockProps> = ({
    onAddNode,
    onUndo,
    isChatOpen,
    onToggleChat,
    isMultiFrameOpen,
    onToggleMultiFrame,
    isSonicStudioOpen,
    onToggleSonicStudio,
    assetHistory,
    onHistoryItemClick,
    onDeleteAsset,
    workflows,
    selectedWorkflowId,
    onSelectWorkflow,
    onSaveWorkflow,
    onDeleteWorkflow,
    onRenameWorkflow,
    onOpenSettings,
    activePanel,
    onChangeActivePanel
}) => {
    const setActivePanel = onChangeActivePanel;
    const [activeHistoryTab, setActiveHistoryTab] = useState<'image' | 'video'>('image');
    const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ visible: boolean, x: number, y: number, id: string, type: 'workflow' | 'history' } | null>(null);
    const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Hover Handlers
    const handleSidebarHover = (id: string) => {
        if (['add', 'history', 'workflow'].includes(id)) {
            if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
            setActivePanel(id as any);
        } else {
            // Close panel if hovering over non-panel items (undo/chat/smart_sequence)
            closeTimeoutRef.current = setTimeout(() => setActivePanel(null), 100);
        }
    };

    const handleSidebarLeave = () => {
        closeTimeoutRef.current = setTimeout(() => setActivePanel(null), 500);
    };

    const handlePanelEnter = () => {
        if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };

    const handlePanelLeave = () => {
        closeTimeoutRef.current = setTimeout(() => setActivePanel(null), 500);
    };

    // Close context menu on global click
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const renderPanelContent = () => {
        if (activePanel === 'history') {
            const filteredAssets = assetHistory.filter(a => {
                if (activeHistoryTab === 'image') return a.type === 'image' || a.type.includes('image') || a.type.includes('image_generator');
                if (activeHistoryTab === 'video') return a.type === 'video' || a.type.includes('video');
                return false;
            });

            return (
                <>
                    <div className="p-4 border-b border-white/5 flex flex-col gap-3 bg-white/5">
                        <div className="flex justify-between items-center">
                            <button onClick={() => setActivePanel(null)}><X size={14} className="text-slate-500 hover:text-white" /></button>
                            <span className="text-xs font-bold uppercase tracking-widest text-white/50">历史记录</span>
                        </div>
                        {/* Tabs */}
                        <div className="flex bg-black/20 p-1 rounded-lg">
                            <button 
                                onClick={() => setActiveHistoryTab('image')}
                                className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-[10px] font-bold rounded-md transition-all ${activeHistoryTab === 'image' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <ImageIcon size={12} /> 图片
                            </button>
                            <button 
                                onClick={() => setActiveHistoryTab('video')}
                                className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-[10px] font-bold rounded-md transition-all ${activeHistoryTab === 'video' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <VideoIcon size={12} /> 视频
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-2 relative">
                        {filteredAssets.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-slate-500 opacity-60 select-none">
                                {activeHistoryTab === 'image' ? <ImageIcon size={48} strokeWidth={1} className="mb-3 opacity-50" /> : <Film size={48} strokeWidth={1} className="mb-3 opacity-50" />}
                                <span className="text-[10px] font-medium tracking-widest uppercase">暂无{activeHistoryTab === 'image' ? '图片' : '视频'}</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2 p-1">
                                {filteredAssets.map(a => (
                                    <div 
                                        key={a.id} 
                                        className="aspect-square rounded-xl overflow-hidden cursor-grab active:cursor-grabbing border border-white/5 hover:border-cyan-500/50 transition-colors group relative shadow-md bg-black/20"
                                        draggable={true}
                                        onDragStart={(e) => {
                                            e.dataTransfer.setData('application/json', JSON.stringify(a));
                                            e.dataTransfer.effectAllowed = 'copy';
                                        }}
                                        onClick={() => onHistoryItemClick(a)}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setContextMenu({ visible: true, x: e.clientX, y: e.clientY, id: a.id, type: 'history' });
                                        }}
                                    >
                                        {a.type.includes('image') ? (
                                            <img src={a.src} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" draggable={false} />
                                        ) : (
                                            <video src={a.src} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" draggable={false} />
                                        )}
                                        <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[8px] font-bold text-white/70">
                                            {a.type.includes('image') ? 'IMG' : 'MOV'}
                                        </div>
                                        <div className="absolute bottom-0 left-0 w-full p-1.5 bg-gradient-to-t from-black/80 to-transparent text-[9px] text-white/90 truncate font-medium">
                                            {a.title || 'Untitled'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            );
        }

        if (activePanel === 'workflow') {
            return (
                <>
                    <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                        <span className="text-xs font-bold uppercase tracking-widest text-white/50">
                            我的工作流
                        </span>
                        <button onClick={onSaveWorkflow} className="p-1.5 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500 hover:text-white rounded-md transition-colors" title="保存当前工作流">
                            <Save size={14} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-3 relative">
                        {workflows.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-slate-500 opacity-60 select-none">
                                <FolderHeart size={48} strokeWidth={1} className="mb-3 opacity-50" />
                                <span className="text-[10px] font-medium tracking-widest uppercase text-center">空空如也<br/>保存您的第一个工作流</span>
                            </div>
                        ) : (
                            workflows.map(wf => (
                                <div 
                                    key={wf.id} 
                                    className={`
                                        relative p-2 rounded-xl border bg-black/20 group transition-all duration-300 cursor-grab active:cursor-grabbing hover:bg-white/5
                                        ${selectedWorkflowId === wf.id ? 'border-cyan-500/50 ring-1 ring-cyan-500/20' : 'border-white/5 hover:border-white/20'}
                                    `}
                                    draggable={true}
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('application/workflow-id', wf.id);
                                        e.dataTransfer.effectAllowed = 'copy';
                                    }}
                                    onClick={(e) => { e.stopPropagation(); onSelectWorkflow(wf.id); }}
                                    onDoubleClick={(e) => { e.stopPropagation(); setEditingWorkflowId(wf.id); }}
                                    onContextMenu={(e) => { 
                                        e.preventDefault(); 
                                        e.stopPropagation(); 
                                        setContextMenu({visible: true, x: e.clientX, y: e.clientY, id: wf.id, type: 'workflow'}); 
                                    }}
                                >
                                    <div className="aspect-[2/1] bg-black/40 rounded-lg mb-2 overflow-hidden relative">
                                        {wf.thumbnail ? (
                                            <img src={wf.thumbnail} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" draggable={false} />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                                                <WorkflowIcon size={24} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between px-1">
                                        {editingWorkflowId === wf.id ? (
                                            <input 
                                                className="bg-black/50 border border-cyan-500/50 rounded px-1 text-xs text-white w-full outline-none"
                                                defaultValue={wf.title}
                                                autoFocus
                                                onBlur={(e) => { onRenameWorkflow(wf.id, e.target.value); setEditingWorkflowId(null); }}
                                                onKeyDown={(e) => { if(e.key === 'Enter') { onRenameWorkflow(wf.id, e.currentTarget.value); setEditingWorkflowId(null); } }}
                                            />
                                        ) : (
                                            <span className="text-xs font-medium text-slate-300 truncate select-none group-hover:text-white transition-colors">{wf.title}</span>
                                        )}
                                        <span className="text-[9px] text-slate-600 font-mono">{wf.nodes.length} 节点</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            );
        }

        // Default: Add Node
        return (
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-5">
                {/* 添加节点 Section */}
                <div className="space-y-2">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-2 mb-1">添加节点</div>
                    
                    {/* 文本 Item */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); onAddNode(NodeType.PROMPT_INPUT); setActivePanel(null); }}
                        className="w-full text-left p-2 rounded-[14px] hover:bg-white/5 flex items-center gap-3 transition-all group duration-200"
                    >
                        <div className="w-9 h-9 bg-zinc-800/40 group-hover:bg-zinc-800/80 rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-zinc-200 transition-colors border border-white/5">
                            <Type size={16} />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-[12px] font-semibold text-zinc-200 group-hover:text-white transition-colors">文本</span>
                            <span className="text-[10px] text-zinc-500 truncate group-hover:text-zinc-400 transition-colors mt-0.5">脚本、广告词、品牌文案</span>
                        </div>
                    </button>

                    {/* 图片 Item */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); onAddNode(NodeType.IMAGE_GENERATOR); setActivePanel(null); }}
                        className="w-full text-left p-2 rounded-[14px] hover:bg-white/5 flex items-center gap-3 transition-all group duration-200"
                    >
                        <div className="w-9 h-9 bg-zinc-800/40 group-hover:bg-zinc-800/80 rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-zinc-200 transition-colors border border-white/5">
                            <ImageIcon size={16} />
                        </div>
                        <span className="text-[12px] font-semibold text-zinc-200 group-hover:text-white transition-colors">图片</span>
                    </button>

                    {/* 视频 Item */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); onAddNode(NodeType.VIDEO_GENERATOR); setActivePanel(null); }}
                        className="w-full text-left p-2 rounded-[14px] hover:bg-white/5 flex items-center gap-3 transition-all group duration-200"
                    >
                        <div className="w-9 h-9 bg-zinc-800/40 group-hover:bg-zinc-800/80 rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-zinc-200 transition-colors border border-white/5">
                            <Film size={16} />
                        </div>
                        <span className="text-[12px] font-semibold text-zinc-200 group-hover:text-white transition-colors">视频</span>
                    </button>

                    {/* 3D 世界 Item */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); onAddNode(NodeType.VIDEO_ANALYZER); setActivePanel(null); }}
                        className="w-full text-left p-2 rounded-[14px] hover:bg-white/5 flex items-center gap-3 transition-all group duration-200"
                    >
                        <div className="w-9 h-9 bg-zinc-800/40 group-hover:bg-zinc-800/80 rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-zinc-200 transition-colors border border-white/5">
                            <Globe size={16} />
                        </div>
                        <span className="text-[12px] font-semibold text-zinc-200 group-hover:text-white transition-colors">3D 世界</span>
                    </button>

                    {/* 音频 Item */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); onAddNode(NodeType.AUDIO_GENERATOR); setActivePanel(null); }}
                        className="w-full text-left p-2 rounded-[14px] hover:bg-white/5 flex items-center gap-3 transition-all group duration-200"
                    >
                        <div className="w-9 h-9 bg-zinc-800/40 group-hover:bg-zinc-800/80 rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-zinc-200 transition-colors border border-white/5">
                            <Volume2 size={16} />
                        </div>
                        <span className="text-[12px] font-semibold text-zinc-200 group-hover:text-white transition-colors">音频</span>
                    </button>
                </div>

                {/* 功能节点 Section */}
                <div className="space-y-2">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-2 mb-1">功能节点</div>

                    {/* 分镜格子 Item */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); onToggleMultiFrame(); setActivePanel(null); }}
                        className="w-full text-left p-2 rounded-[14px] hover:bg-white/5 flex items-center gap-3 transition-all group duration-200"
                    >
                        <div className="w-9 h-9 bg-zinc-800/40 group-hover:bg-zinc-800/80 rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-zinc-200 transition-colors border border-white/5">
                            <Clapperboard size={16} />
                        </div>
                        <span className="text-[12px] font-semibold text-zinc-200 group-hover:text-white transition-colors">分镜格子</span>
                    </button>

                    {/* AI 应用 Item */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); onToggleChat(); setActivePanel(null); }}
                        className="w-full text-left p-2 rounded-[14px] hover:bg-white/5 flex items-center gap-3 transition-all group duration-200"
                    >
                        <div className="w-9 h-9 bg-zinc-800/40 group-hover:bg-zinc-800/80 rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-zinc-200 transition-colors border border-white/5">
                            <Layers size={16} />
                        </div>
                        <span className="text-[12px] font-semibold text-zinc-200 group-hover:text-white transition-colors">AI 应用</span>
                    </button>
                </div>

                {/* 添加资源 Section */}
                <div className="space-y-2">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-2 mb-1">添加资源</div>

                    {/* 上传 Item */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); onAddNode(NodeType.IMAGE_GENERATOR); setActivePanel(null); }}
                        className="w-full text-left p-2 rounded-[14px] hover:bg-white/5 flex items-center gap-3 transition-all group duration-200"
                    >
                        <div className="w-9 h-9 bg-zinc-800/40 group-hover:bg-zinc-800/80 rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-zinc-200 transition-colors border border-white/5">
                            <Upload size={16} />
                        </div>
                        <span className="text-[12px] font-semibold text-zinc-200 group-hover:text-white transition-colors">上传</span>
                    </button>

                    {/* 从资产导入 Item */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); setActivePanel('history'); }}
                        className="w-full text-left p-2 rounded-[14px] hover:bg-white/5 flex items-center gap-3 transition-all group duration-200"
                    >
                        <div className="w-9 h-9 bg-zinc-800/40 group-hover:bg-zinc-800/80 rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-zinc-200 transition-colors border border-white/5">
                            <Box size={16} />
                        </div>
                        <span className="text-[12px] font-semibold text-zinc-200 group-hover:text-white transition-colors">从资产导入</span>
                    </button>
                </div>
            </div>
        );
    };

    return (
        <>
            {/* Left Vertical Dock */}
            <div 
                className="fixed left-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4 py-5 px-3 bg-[#0d0d10]/85 backdrop-blur-3xl border border-white/5 rounded-[28px] shadow-2xl z-50 animate-in slide-in-from-left-10 duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
                onMouseLeave={handleSidebarLeave}
            >
                {/* Top circular Add (+) button */}
                <div className="relative group">
                    <button 
                        onMouseEnter={() => handleSidebarHover('add')}
                        onClick={() => setActivePanel(activePanel === 'add' ? null : 'add')}
                        className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 shadow-md ${activePanel === 'add' ? 'bg-white/20 text-white' : 'bg-white hover:bg-cyan-500 hover:text-white text-black shadow-white/5'}`}
                    >
                        {activePanel === 'add' ? <X size={20} strokeWidth={2.5} /> : <Plus size={20} strokeWidth={2.5} />}
                    </button>
                    {/* Tooltip */}
                    <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-black/80 backdrop-blur-md rounded border border-white/5 text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                        添加节点
                    </div>
                </div>

                <div className="w-8 h-px bg-white/5 my-1"></div>

                {/* Primary Navigation Items */}
                {[
                    { id: 'history', icon: Box, label: '资产', isPanel: true },
                    { id: 'workflow', icon: WorkflowIcon, label: '工作流', isPanel: true },
                    { id: 'chat', icon: History, label: '历史', action: onToggleChat, active: isChatOpen },
                    { id: 'smart_sequence', icon: Clapperboard, label: '导演台', action: onToggleMultiFrame, active: isMultiFrameOpen },
                    { id: 'editor', icon: Edit, label: '剪辑', action: () => onAddNode(NodeType.IMAGE_EDITOR) }
                ].map(item => {
                    const isSelected = activePanel === item.id || item.active;
                    return (
                        <div key={item.id} className="relative group">
                            <button 
                                onMouseEnter={() => item.isPanel && handleSidebarHover(item.id)}
                                onClick={() => item.action ? item.action() : setActivePanel(item.id as any)}
                                className={`flex flex-col items-center gap-1.5 w-12 py-2 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 ${isSelected ? 'text-cyan-400 bg-white/5' : 'text-zinc-400 hover:text-zinc-100'}`}
                            >
                                <item.icon size={19} strokeWidth={2} className="transition-transform duration-300 group-hover:-translate-y-0.5" />
                                <span className="text-[10px] font-medium tracking-wider scale-95 transition-colors duration-300 select-none">
                                    {item.label}
                                </span>
                            </button>
                        </div>
                    );
                })}
                
                {/* Spacer & Utility buttons */}
                <div className="w-8 h-px bg-white/5 my-1"></div>
                
                <div className="flex flex-col gap-1">
                    <button 
                        onClick={onUndo}
                        className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
                        title="撤销 (Undo)"
                    >
                        <RotateCcw size={16} strokeWidth={2} />
                    </button>
                    
                    <button 
                        onClick={onOpenSettings}
                        className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
                        title="设置 (Settings)"
                    >
                        <Settings size={16} strokeWidth={2} />
                    </button>
                </div>
            </div>

            {/* Slide-out Panels */}
            <div 
                className={`fixed left-[116px] top-1/2 -translate-y-1/2 max-h-[75vh] h-auto w-80 bg-[#0c0c0e]/95 backdrop-blur-3xl border border-white/5 rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-500 ease-[${SPRING}] z-40 flex flex-col overflow-hidden ${activePanel ? 'translate-x-0 opacity-100' : '-translate-x-10 opacity-0 pointer-events-none scale-95'}`}
                onMouseEnter={handlePanelEnter}
                onMouseLeave={handlePanelLeave}
                onMouseDown={(e) => e.stopPropagation()}
                onWheel={(e) => e.stopPropagation()}
            >
                {activePanel && renderPanelContent()}
            </div>

            {/* Global Context Menu (Rendered outside the transformed panel to fix positioning) */}
            {contextMenu && (
                <div 
                    className="fixed z-[100] bg-[#2c2c2e] border border-white/10 rounded-lg shadow-2xl p-1 animate-in fade-in zoom-in-95 duration-200 min-w-[120px]"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onMouseDown={e => e.stopPropagation()}
                    onMouseLeave={() => setContextMenu(null)}
                >
                    {contextMenu.type === 'history' && (
                         <button className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/20 rounded-md flex items-center gap-2" onClick={() => { onDeleteAsset(contextMenu.id); setContextMenu(null); }}>
                             <Trash2 size={12} /> 删除
                         </button>
                    )}
                    {contextMenu.type === 'workflow' && (
                        <>
                            <button className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-white/10 rounded-md flex items-center gap-2" onClick={() => { setEditingWorkflowId(contextMenu.id); setContextMenu(null); }}>
                                <Edit size={12} /> 重命名
                            </button>
                            <button className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/20 rounded-md flex items-center gap-2" onClick={() => { onDeleteWorkflow(contextMenu.id); setContextMenu(null); }}>
                                <Trash2 size={12} /> 删除
                            </button>
                        </>
                    )}
                </div>
            )}
        </>
    );
};
