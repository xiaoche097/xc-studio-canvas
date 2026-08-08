
import React, { useState, useRef, useEffect } from 'react';
import { 
    Plus, RotateCcw, History, MessageSquare, FolderHeart, X, 
    ImageIcon, Video as VideoIcon, Film, Save, FolderPlus, 
    Edit, Trash2, Box, ScanFace, Brush, Type, Workflow as WorkflowIcon,
    Clapperboard, Mic2, Settings, Globe, Layers, Upload, Volume2,
    Eye, Sparkles, Search, ChevronLeft
} from 'lucide-react';
import { NodeType, Workflow } from '../types';
import { OFFICIAL_MODELS, modelLibrary, ModelItem } from '../../Cyzx4/services/modelLibrary';

// 素材库精选假数据
const MOCK_MATERIALS = [
    { id: 'm1', title: '蓝色T恤美女写真', src: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&h=400&q=80', type: 'video', category: '视频' },
    { id: 'm2', title: '蕾丝长腿美女性感展示', src: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&h=400&q=80', type: 'video', category: '视频' },
    { id: 'm3', title: '黑色短裙全身展示', src: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&h=400&q=80', type: 'video', category: '视频' },
    { id: 'm4', title: '长发女子背影写真', src: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&h=400&q=80', type: 'video', category: '视频' },
    
    { id: 'm5', title: '现代科技极简客厅', src: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=400&h=400&q=80', type: 'image', category: '全景' },
    { id: 'm6', title: '赛博朋克霓虹街区', src: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=400&h=400&q=80', type: 'image', category: '全景' },
    
    { id: 'm7', title: '水墨山水画意境', src: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&h=400&q=80', type: 'image', category: '长图' },
    
    { id: 'm8', title: '高定黑色西装', src: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=400&h=400&q=80', type: 'image', category: '服装' },
    
    { id: 'm9', title: '可爱柴犬特写', src: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=400&h=400&q=80', type: 'image', category: '宠物' },
    
    { id: 'm10', title: '北欧风暖冬书房', src: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=400&h=400&q=80', type: 'image', category: '场景' },
    
    { id: 'm11', title: '无缝透明绿植卡片', src: 'https://images.unsplash.com/photo-1463936575829-25148e1db1b8?auto=format&fit=crop&w=400&h=400&q=80', type: 'image', category: '抠图' }
];

// 初始化创意中心模特库的官方标准模特数据源 (Gabi, Clara, Anna)
const DEFAULT_AVATAR_SUITES = OFFICIAL_MODELS.map(model => ({
    id: `suite-${model.id}`,
    title: `${model.name} (官方固定)`,
    src: model.preview,
    type: 'image',
    category: '角色套图',
    items: [
        { id: `suite-${model.id}-1`, title: `${model.name} - 正面特写`, src: model.preview, type: 'image' },
        { id: `suite-${model.id}-2`, title: `${model.name} - 全身商拍`, src: model.preview, type: 'image' },
        { id: `suite-${model.id}-3`, title: `${model.name} - 姿势视图`, src: model.preview, type: 'image' }
    ]
}));

const DEFAULT_AVATARS = OFFICIAL_MODELS.map(model => ({
    id: `avatar-${model.id}`,
    title: `${model.name} (官方固定)`,
    src: model.preview,
    type: 'image',
    category: '角色'
}));

interface SidebarDockProps {
    onAddNode: (type: NodeType) => void;
    onUndo: () => void;
    
    // 历史记录弹窗控制状态
    isHistoryModalOpen: boolean;
    onToggleHistoryModal: () => void;
    
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
    isHistoryModalOpen,
    onToggleHistoryModal,
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

    // 资产大弹窗相关的 State 状态
    const [activeMainTab, setActiveMainTab] = useState<'material' | 'avatar' | 'my_asset'>('material');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMaterialCategory, setSelectedMaterialCategory] = useState('视频');
    const [selectedAvatarCategory, setSelectedAvatarCategory] = useState('角色套图');
    const [selectedAvatarSuite, setSelectedAvatarSuite] = useState<any | null>(null);
    const [selectedMyAssetCategory, setSelectedMyAssetCategory] = useState('全部');

    const [avatarSuites, setAvatarSuites] = useState<any[]>(DEFAULT_AVATAR_SUITES);
    const [avatars, setAvatars] = useState<any[]>(DEFAULT_AVATARS);

    useEffect(() => {
        let isMounted = true;
        async function loadModelLibrary() {
            try {
                const models = await modelLibrary.list();
                if (!isMounted) return;
                const suites = models.map(model => ({
                    id: `suite-${model.id}`,
                    title: `${model.name} ${model.isOfficial ? '(官方固定)' : '(自定义模特)'}`,
                    src: model.preview,
                    type: 'image',
                    category: '角色套图',
                    items: [
                        { id: `suite-${model.id}-1`, title: `${model.name} - 正面特写`, src: model.preview, type: 'image' },
                        { id: `suite-${model.id}-2`, title: `${model.name} - 全身商拍`, src: model.preview, type: 'image' },
                        { id: `suite-${model.id}-3`, title: `${model.name} - 姿势视图`, src: model.preview, type: 'image' }
                    ]
                }));
                const singleAvatars = models.map(model => ({
                    id: `avatar-${model.id}`,
                    title: `${model.name} ${model.isOfficial ? '(官方固定)' : '(自定义模特)'}`,
                    src: model.preview,
                    type: 'image',
                    category: '角色'
                }));
                setAvatarSuites(suites);
                setAvatars(singleAvatars);
            } catch (err) {
                console.error('加载模特库失败:', err);
            }
        }
        if (activePanel === 'history' && activeMainTab === 'avatar') {
            loadModelLibrary();
        }
        return () => { isMounted = false; };
    }, [activePanel, activeMainTab]);

    const [workflowSearchQuery, setWorkflowSearchQuery] = useState('');
    const [activeWorkflowMainTab] = useState<'inspiration' | 'my_workflow'>('my_workflow');
    const selectedWorkflowTemplateCategory = '全部';
    const setSelectedWorkflowTemplateCategory = (_category: string) => undefined;

    // Hover Handlers
    const handleSidebarHover = (id: string) => {
        // 如果资产或工作流中心大弹窗处于打开状态，悬停侧边栏不触发任何面板切换与自动关闭
        if (['history', 'workflow'].includes(activePanel)) return;

        // 仅 'add' 通过 hover 展开窄面板，'workflow' 和 'history' 改为点击触发大弹窗
        if (['add'].includes(id)) {
            if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
            setActivePanel(id as any);
        } else {
            // Close panel if hovering over non-panel items (undo/chat/smart_sequence)
            closeTimeoutRef.current = setTimeout(() => setActivePanel(null), 100);
        }
    };

    const handleSidebarLeave = () => {
        if (['history', 'workflow'].includes(activePanel)) return;
        closeTimeoutRef.current = setTimeout(() => setActivePanel(null), 500);
    };

    const handlePanelEnter = () => {
        if (['history', 'workflow'].includes(activePanel)) return;
        if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };

    const handlePanelLeave = () => {
        if (['history', 'workflow'].includes(activePanel)) return;
        closeTimeoutRef.current = setTimeout(() => setActivePanel(null), 500);
    };

    // Close context menu on global click
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const renderPanelContent = () => {
        if (activePanel === 'history' || activePanel === 'workflow') {
            return null; // 资产与工作流大弹窗独立在全局层级渲染，此处返回 null 避免窄版左边栏滑出
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
                        onClick={(e) => { e.stopPropagation(); onAddNode(NodeType.STORYBOARD_GRID); setActivePanel(null); }}
                        className="w-full text-left p-2 rounded-[14px] hover:bg-white/5 flex items-center gap-3 transition-all group duration-200"
                    >
                        <div className="w-9 h-9 bg-zinc-800/40 group-hover:bg-zinc-800/80 rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-zinc-200 transition-colors border border-white/5">
                            <Clapperboard size={16} />
                        </div>
                        <span className="text-[12px] font-semibold text-zinc-200 group-hover:text-white transition-colors">分镜格子</span>
                    </button>

                    {/* 历史记录 Item */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); onToggleHistoryModal(); setActivePanel(null); }}
                        className="w-full text-left p-2 rounded-[14px] hover:bg-white/5 flex items-center gap-3 transition-all group duration-200"
                    >
                        <div className="w-9 h-9 bg-zinc-800/40 group-hover:bg-zinc-800/80 rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-zinc-200 transition-colors border border-white/5">
                            <History size={16} />
                        </div>
                        <span className="text-[12px] font-semibold text-zinc-200 group-hover:text-white transition-colors">历史记录</span>
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

                {/* 左侧主要导航栏配置 */}
                {[
                    { id: 'history', icon: Box, label: '资产', isPanel: true },
                    { id: 'workflow', icon: WorkflowIcon, label: '工作流', isPanel: true },
                    { id: 'history_modal', icon: History, label: '历史', action: onToggleHistoryModal, active: isHistoryModalOpen },
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
                className={`fixed left-[116px] top-1/2 -translate-y-1/2 max-h-[75vh] h-auto w-80 bg-[#0c0c0e]/95 backdrop-blur-3xl border border-white/5 rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-500 ease-[${SPRING}] z-40 flex flex-col overflow-hidden ${activePanel && activePanel !== 'history' && activePanel !== 'workflow' ? 'translate-x-0 opacity-100' : '-translate-x-10 opacity-0 pointer-events-none scale-95'}`}
                onMouseEnter={handlePanelEnter}
                onMouseLeave={handlePanelLeave}
                onMouseDown={(e) => e.stopPropagation()}
                onWheel={(e) => e.stopPropagation()}
            >
                {activePanel && activePanel !== 'history' && activePanel !== 'workflow' && renderPanelContent()}
            </div>

            {/* 资产管理中心大弹窗 (AIGC 资产中心) */}
            {activePanel === 'history' && (() => {
                // 根据当前选中分类和搜索词进行实时过滤
                const filteredMaterials = MOCK_MATERIALS.filter(m => {
                    const matchesCategory = m.category === selectedMaterialCategory;
                    const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase());
                    return matchesCategory && matchesSearch;
                });

                const filteredAvatarSuites = avatarSuites.filter(s => {
                    const matchesSearch = s.title.toLowerCase().includes(searchQuery.toLowerCase());
                    return matchesSearch;
                });

                const filteredAvatars = avatars.filter(a => {
                    const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase());
                    return matchesSearch;
                });

                const filteredMyAssets = assetHistory.filter(a => {
                    const matchesSearch = (a.title || '未命名').toLowerCase().includes(searchQuery.toLowerCase());
                    if (selectedMyAssetCategory === '全部') return matchesSearch;
                    if (selectedMyAssetCategory === '人物') return matchesSearch && (a.type.includes('avatar') || (a.title && a.title.includes('人物')));
                    if (selectedMyAssetCategory === '场景') return matchesSearch && (a.title && a.title.includes('场景'));
                    if (selectedMyAssetCategory === '物品') return matchesSearch && (a.title && a.title.includes('物品'));
                    if (selectedMyAssetCategory === '风格') return matchesSearch && (a.title && a.title.includes('风格'));
                    return matchesSearch;
                });

                return (
                    <div 
                        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-300"
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        {/* 背景点击关闭 */}
                        <div className="absolute inset-0" onClick={() => setActivePanel(null)} />
                        
                        {/* 弹窗核心容器 */}
                        <div 
                            className="relative w-[92vw] max-w-6xl h-[82vh] bg-[#0c0c0f]/95 backdrop-blur-3xl border border-white/10 rounded-[32px] shadow-[0_24px_70px_rgba(0,0,0,0.7)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 text-left"
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            {/* 顶部标签式大导航栏 */}
                            <div className="flex gap-8 border-b border-white/5 px-8 pt-6 pb-4 items-center justify-between shrink-0 bg-white/[0.02]">
                                <div className="flex items-center gap-6">
                                    <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5">
                                        {[
                                            { id: 'material', label: '素材库' },
                                            { id: 'avatar', label: '虚拟人像库' },
                                            { id: 'my_asset', label: '我的资产' }
                                        ].map(tab => (
                                            <button
                                                key={tab.id}
                                                onClick={() => {
                                                    setActiveMainTab(tab.id as any);
                                                    setSearchQuery(''); // 切换时清空搜索
                                                    setSelectedAvatarSuite(null);
                                                }}
                                                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${activeMainTab === tab.id ? 'bg-white/10 text-emerald-400 shadow-md scale-105 border border-white/5' : 'text-zinc-400 hover:text-zinc-200'}`}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                
                                {/* 搜索与关闭按钮 */}
                                <div className="flex items-center gap-4">
                                    <button
                                        type="button"
                                        onClick={onSaveWorkflow}
                                        className="flex h-9 items-center gap-2 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 text-xs font-bold text-black transition-all hover:scale-105 hover:shadow-lg hover:shadow-emerald-500/20 active:scale-95"
                                        title="将当前画布保存到我的工作流"
                                    >
                                        <Save size={14} />
                                        保存当前画布
                                    </button>
                                    <div className="relative flex items-center">
                                        <Search size={14} className="absolute left-3 text-zinc-500" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder={
                                                activeMainTab === 'material' ? '搜索素材库素材...' :
                                                activeMainTab === 'avatar' ? '搜索虚拟人像...' :
                                                '搜索我的资产...'
                                            }
                                            className="w-64 bg-black/40 border border-white/5 rounded-full pl-9 pr-8 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all font-medium"
                                        />
                                        {searchQuery && (
                                            <button 
                                                onClick={() => setSearchQuery('')}
                                                className="absolute right-3 text-zinc-500 hover:text-zinc-200"
                                            >
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>
                                    <button 
                                        onClick={() => setActivePanel(null)}
                                        className="p-2 text-zinc-400 hover:text-white bg-zinc-800/40 hover:bg-zinc-800/80 rounded-full border border-white/5 transition-all"
                                    >
                                        <X size={15} />
                                    </button>
                                </div>
                            </div>

                            {/* 子类别药丸 Pill 选择器 */}
                            <div className="flex gap-2.5 px-8 py-4 bg-white/[0.01] border-b border-white/5 overflow-x-auto shrink-0 custom-scrollbar">
                                {/* 素材库小标签 */}
                                {activeMainTab === 'material' && ['视频', '全景', '长图', '服装', '宠物', '场景', '抠图'].map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setSelectedMaterialCategory(cat)}
                                        className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all duration-300 ${selectedMaterialCategory === cat ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-sm' : 'bg-transparent text-zinc-500 border-white/5 hover:text-zinc-300 hover:border-white/10'}`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                                
                                {/* 虚拟人像小标签 */}
                                {activeMainTab === 'avatar' && ['角色套图', '角色'].map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => {
                                            setSelectedAvatarCategory(cat);
                                            setSelectedAvatarSuite(null);
                                        }}
                                        className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all duration-300 ${selectedAvatarCategory === cat ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-sm' : 'bg-transparent text-zinc-500 border-white/5 hover:text-zinc-300 hover:border-white/10'}`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                                
                                {/* 我的资产小标签 */}
                                {activeMainTab === 'my_asset' && ['全部', '人物', '场景', '物品', '风格', '其他'].map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setSelectedMyAssetCategory(cat)}
                                        className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all duration-300 ${selectedMyAssetCategory === cat ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-sm' : 'bg-transparent text-zinc-500 border-white/5 hover:text-zinc-300 hover:border-white/10'}`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>

                            {/* 核心卡片列表滚动区域 */}
                            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                {/* 素材库面板 */}
                                {activeMainTab === 'material' && (
                                    filteredMaterials.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-zinc-500 opacity-60 select-none">
                                            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                                                <ImageIcon size={24} className="text-zinc-400" />
                                            </div>
                                            <span className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">无匹配素材</span>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                                            {filteredMaterials.map(m => (
                                                <div 
                                                    key={m.id}
                                                    onClick={() => {
                                                        onHistoryItemClick(m);
                                                        setActivePanel(null); // 添加后自动关闭弹窗
                                                    }}
                                                    className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-white/5 bg-zinc-900/50 hover:border-emerald-500/50 transition-all duration-300 group cursor-pointer shadow-lg hover:shadow-emerald-500/5 hover:-translate-y-1"
                                                >
                                                    {m.type === 'video' ? (
                                                        <video src={m.src} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100" loop muted playsInline />
                                                    ) : (
                                                        <img src={m.src} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100" alt={m.title} />
                                                    )}
                                                    {/* 类型标签 */}
                                                    <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[9px] font-bold text-white/70 border border-white/5">
                                                        {m.type === 'video' ? '🎥 视频' : '📷 图片'}
                                                    </div>
                                                    {/* 底部信息高光条 */}
                                                    <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/95 via-black/50 to-transparent text-[11px] font-semibold text-zinc-200 group-hover:text-white truncate flex items-center">
                                                        {m.title}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                )}

                                {/* 虚拟人像库 / 模特库面板 */}
                                {activeMainTab === 'avatar' && (
                                    selectedAvatarSuite ? (
                                        /* 模特套图查看详情页 View (图3 细节) */
                                        <div className="flex flex-col gap-6">
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => setSelectedAvatarSuite(null)}
                                                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/10 shadow-md active:scale-95"
                                                >
                                                    <ChevronLeft size={16} />
                                                    <span>{selectedAvatarSuite.title}</span>
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-6">
                                                {selectedAvatarSuite.items.map((item: any) => (
                                                    <div 
                                                        key={item.id}
                                                        onClick={() => {
                                                            onHistoryItemClick(item);
                                                            setActivePanel(null);
                                                        }}
                                                        className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-white/5 bg-zinc-900/50 hover:border-emerald-500/50 transition-all duration-300 group cursor-pointer shadow-lg hover:shadow-emerald-500/5 hover:-translate-y-1"
                                                    >
                                                        <img src={item.src} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100" alt={item.title} />
                                                        
                                                        {/* Hover 磨砂按钮覆盖层 */}
                                                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-4">
                                                            <button 
                                                                onClick={(e) => { 
                                                                    e.stopPropagation(); 
                                                                    onHistoryItemClick(item); 
                                                                    setActivePanel(null);
                                                                }}
                                                                className="px-5 py-2.5 rounded-full bg-emerald-500/80 hover:bg-emerald-500 border border-emerald-400/30 text-xs font-bold text-white transition-all shadow-lg shadow-emerald-500/10 active:scale-95 animate-in slide-in-from-bottom-2 duration-300"
                                                            >
                                                                添加到画布
                                                            </button>
                                                        </div>
                                                        
                                                        {/* 类别/图片 标签 */}
                                                        <div className="absolute bottom-10 left-3 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[9px] font-bold text-white/80 border border-white/5 flex items-center gap-1">
                                                            <ImageIcon size={10} />
                                                            <span>图片</span>
                                                        </div>
                                                        
                                                        {/* 底部信息高光条 */}
                                                        <div className="absolute bottom-0 left-0 w-full p-3 bg-gradient-to-t from-black/95 via-black/50 to-transparent text-[11px] font-semibold text-zinc-200 group-hover:text-white truncate">
                                                            {item.title}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : selectedAvatarCategory === '角色套图' ? (
                                        /* 角色套图主列表 (图2 细节) */
                                        filteredAvatarSuites.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-20 text-zinc-500 opacity-60 select-none">
                                                <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                                                    <ScanFace size={24} className="text-zinc-400" />
                                                </div>
                                                <span className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">无匹配角色套图</span>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                                                {filteredAvatarSuites.map(suite => (
                                                    <div 
                                                        key={suite.id}
                                                        className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-white/5 bg-zinc-900/50 hover:border-emerald-500/50 transition-all duration-300 group shadow-lg hover:shadow-emerald-500/5 hover:-translate-y-1"
                                                    >
                                                        <img src={suite.src} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100" alt={suite.title} />
                                                        
                                                        {/* Hover 磨砂按钮双按键覆盖层 (查看 & 全部添加到画布) */}
                                                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-3 p-3">
                                                            <button 
                                                                onClick={(e) => { 
                                                                    e.stopPropagation(); 
                                                                    setSelectedAvatarSuite(suite); 
                                                                }}
                                                                className="w-36 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-md text-xs font-bold text-white transition-all shadow-md active:scale-95 animate-in slide-in-from-bottom-2 duration-300"
                                                            >
                                                                查看
                                                            </button>
                                                            <button 
                                                                onClick={(e) => { 
                                                                    e.stopPropagation(); 
                                                                    suite.items.forEach(item => {
                                                                        onHistoryItemClick(item);
                                                                    });
                                                                    setActivePanel(null); // 添加后自动关闭弹窗
                                                                }}
                                                                className="w-36 py-2 rounded-full bg-emerald-500/80 hover:bg-emerald-500 border border-emerald-400/30 text-xs font-bold text-white transition-all shadow-lg shadow-emerald-500/10 active:scale-95 animate-in slide-in-from-bottom-2 duration-300 delay-75"
                                                            >
                                                                全部添加到画布
                                                            </button>
                                                        </div>
                                                        
                                                        {/* 底部信息高光条 */}
                                                        <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/95 via-black/50 to-transparent text-[11px] font-semibold text-zinc-200 group-hover:text-white truncate flex items-center">
                                                            {suite.title}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )
                                    ) : (
                                        /* 角色单图列表 */
                                        filteredAvatars.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-20 text-zinc-500 opacity-60 select-none">
                                                <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                                                    <ScanFace size={24} className="text-zinc-400" />
                                                </div>
                                                <span className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">无匹配角色</span>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                                                {filteredAvatars.map(a => (
                                                    <div 
                                                        key={a.id}
                                                        className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-white/5 bg-zinc-900/50 hover:border-emerald-500/50 transition-all duration-300 group shadow-lg hover:shadow-emerald-500/5 hover:-translate-y-1"
                                                    >
                                                        <img src={a.src} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100" alt={a.title} />
                                                        
                                                        {/* Hover 磨砂按钮覆盖层 */}
                                                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-4">
                                                            <button 
                                                                onClick={(e) => { 
                                                                    e.stopPropagation(); 
                                                                    onHistoryItemClick(a); 
                                                                    setActivePanel(null);
                                                                }}
                                                                className="px-5 py-2.5 rounded-full bg-emerald-500/80 hover:bg-emerald-500 border border-emerald-400/30 text-xs font-bold text-white transition-all shadow-lg shadow-emerald-500/10 active:scale-95 animate-in slide-in-from-bottom-2 duration-300"
                                                            >
                                                                添加到画布
                                                            </button>
                                                        </div>
                                                        
                                                        {/* 底部信息高光条 */}
                                                        <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/95 via-black/50 to-transparent text-[11px] font-semibold text-zinc-200 group-hover:text-white truncate flex items-center">
                                                            {a.title}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )
                                    )
                                )}

                                {/* 我的资产面板 (整合 IndexedDB / 生成历史) */}
                                {activeMainTab === 'my_asset' && (
                                    filteredMyAssets.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-zinc-500 opacity-60 select-none col-span-full">
                                            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 3.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/></svg>
                                            </div>
                                            <span className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">暂无内容</span>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                                            {filteredMyAssets.map(a => (
                                                <div 
                                                    key={a.id}
                                                    onClick={() => {
                                                        onHistoryItemClick(a);
                                                        setActivePanel(null); // 添加后自动关闭弹窗
                                                    }}
                                                    onContextMenu={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setContextMenu({ visible: true, x: e.clientX, y: e.clientY, id: a.id, type: 'history' });
                                                    }}
                                                    className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-white/5 bg-zinc-900/50 hover:border-emerald-500/50 transition-all duration-300 group cursor-pointer shadow-lg hover:shadow-emerald-500/5 hover:-translate-y-1"
                                                >
                                                    {a.type.includes('video') ? (
                                                        <video src={a.src} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100" loop muted playsInline />
                                                    ) : (
                                                        <img src={a.src} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100" alt={a.title} />
                                                    )}
                                                    {/* 类型标签 */}
                                                    <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[9px] font-bold text-white/70 border border-white/5">
                                                        {a.type.includes('video') ? '🎥 视频' : '📷 图片'}
                                                    </div>
                                                    {/* 底部信息高光条 */}
                                                    <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/95 via-black/50 to-transparent text-[11px] font-semibold text-zinc-200 group-hover:text-white truncate flex items-center">
                                                        {a.title || '已生成资产'}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* 工作流中心大弹窗 (AIGC 工作流中心) */}
            {activePanel === 'workflow' && (() => {
                // 根据当前选中分类和搜索词进行实时过滤
                const filteredTemplates: Array<{ id: string; title: string; src: string; category: string }> = [];

                const filteredUserWorkflows = workflows.filter(w => {
                    const matchesSearch = w.title.toLowerCase().includes(workflowSearchQuery.toLowerCase());
                    return matchesSearch;
                });

                return (
                    <div 
                        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-300"
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        {/* 背景点击关闭 */}
                        <div className="absolute inset-0" onClick={() => setActivePanel(null)} />
                        
                        {/* 弹窗核心容器 */}
                        <div 
                            className="relative w-[92vw] max-w-6xl h-[82vh] bg-[#0c0c0f]/95 backdrop-blur-3xl border border-white/10 rounded-[32px] shadow-[0_24px_70px_rgba(0,0,0,0.7)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 text-left"
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            {/* 顶部标签式大导航栏 */}
                            <div className="flex gap-8 border-b border-white/5 px-8 pt-6 pb-4 items-center justify-between shrink-0 bg-white/[0.02]">
                                <div className="flex items-center gap-6">
                                    <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5">
                                        {[
                                            { id: 'my_workflow', label: '我的工作流' }
                                        ].map(tab => (
                                            <button
                                                key={tab.id}
                                                onClick={() => {
                                                    setWorkflowSearchQuery('');
                                                }}
                                                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${activeWorkflowMainTab === tab.id ? 'bg-white/10 text-emerald-400 shadow-md scale-105 border border-white/5' : 'text-zinc-400 hover:text-zinc-200'}`}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                
                                {/* 搜索与关闭按钮 */}
                                <div className="flex items-center gap-4">
                                    <div className="relative flex items-center">
                                        <Search size={14} className="absolute left-3 text-zinc-500" />
                                        <input
                                            type="text"
                                            value={workflowSearchQuery}
                                            onChange={(e) => setWorkflowSearchQuery(e.target.value)}
                                            placeholder="搜索我的工作流..."
                                            className="w-64 bg-black/40 border border-white/5 rounded-full pl-9 pr-8 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all font-medium"
                                        />
                                        {workflowSearchQuery && (
                                            <button 
                                                onClick={() => setWorkflowSearchQuery('')}
                                                className="absolute right-3 text-zinc-500 hover:text-zinc-200"
                                            >
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>
                                    <button 
                                        onClick={() => setActivePanel(null)}
                                        className="p-2 text-zinc-400 hover:text-white bg-zinc-800/40 hover:bg-zinc-800/80 rounded-full border border-white/5 transition-all"
                                    >
                                        <X size={15} />
                                    </button>
                                </div>
                            </div>

                            {/* 子类别药丸 Pill 选择器 - 仅在灵感库中展示 */}
                            {activeWorkflowMainTab === 'inspiration' && (
                                <div className="flex gap-2.5 px-8 py-4 bg-white/[0.01] border-b border-white/5 overflow-x-auto shrink-0 custom-scrollbar animate-in slide-in-from-top-1 duration-200">
                                    {['全部', '行业定制', '数字虚拟', '文案策划', '平面设计', '辅助内容', '电商模版'].map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setSelectedWorkflowTemplateCategory(cat)}
                                            className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all duration-300 ${selectedWorkflowTemplateCategory === cat ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-sm' : 'bg-transparent text-zinc-500 border-white/5 hover:text-zinc-300 hover:border-white/10'}`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* 核心卡片列表滚动区域 */}
                            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                {/* 灵感库面板 */}
                                {activeWorkflowMainTab === 'inspiration' && (
                                    filteredTemplates.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-zinc-500 opacity-60 select-none">
                                            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4 animate-pulse">
                                                <WorkflowIcon size={24} className="text-zinc-400" />
                                            </div>
                                            <span className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">无匹配工作流</span>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                                            {filteredTemplates.map(w => (
                                                <div 
                                                    key={w.id}
                                                    className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-white/5 bg-zinc-900/50 hover:border-emerald-500/50 transition-all duration-300 group shadow-lg hover:shadow-emerald-500/5 hover:-translate-y-1"
                                                >
                                                    <img src={w.src} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100" alt={w.title} />
                                                    
                                                    {/* Hover 磨砂按钮覆盖层 */}
                                                    <div className="absolute inset-0 bg-black/45 backdrop-blur-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-3 p-4">
                                                        <button 
                                                            onClick={(e) => { 
                                                                e.stopPropagation();
                                                                // 可以加载此模版，作为创意演示
                                                                setActivePanel(null);
                                                            }}
                                                            className="px-5 py-2.5 rounded-full bg-emerald-500/80 hover:bg-emerald-500 border border-emerald-400/30 text-xs font-bold text-white transition-all shadow-lg shadow-emerald-500/10 active:scale-95 animate-in slide-in-from-bottom-2 duration-300"
                                                        >
                                                            载入工作流模版
                                                        </button>
                                                    </div>
                                                    
                                                    {/* 类别标签 */}
                                                    <div className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[9px] font-bold text-white/70 border border-white/5">
                                                        ⚡ {w.category}
                                                    </div>
                                                    
                                                    {/* 底部信息高光条 */}
                                                    <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/95 via-black/50 to-transparent text-[11px] font-bold text-zinc-200 group-hover:text-white truncate flex items-center leading-normal">
                                                        {w.title}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                )}

                                {/* 我的工作流面板 */}
                                {activeWorkflowMainTab === 'my_workflow' && (
                                    filteredUserWorkflows.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-zinc-500 select-none col-span-full">
                                            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                                            </div>
                                            <span className="text-xs font-bold tracking-wider text-zinc-400">暂无已保存的工作流</span>
                                            <span className="mt-2 max-w-sm text-center text-[11px] leading-5 text-zinc-600">将调试完成的分组直接保存，或保存当前完整画布，之后可随时加载和拖回画布复用。</span>
                                            <button
                                                type="button"
                                                onClick={onSaveWorkflow}
                                                className="mt-5 flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-xs font-bold text-black transition-all hover:bg-emerald-400 active:scale-95"
                                            >
                                                <Save size={14} />
                                                保存当前画布
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                                            {filteredUserWorkflows.map(wf => (
                                                <div 
                                                    key={wf.id}
                                                    onClick={() => {
                                                        onSelectWorkflow(wf.id);
                                                        setActivePanel(null); // 加载后自动关闭弹窗
                                                    }}
                                                    onContextMenu={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setContextMenu({ visible: true, x: e.clientX, y: e.clientY, id: wf.id, type: 'workflow' });
                                                    }}
                                                    className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-white/5 bg-zinc-900/50 hover:border-emerald-500/50 transition-all duration-300 group cursor-pointer shadow-lg hover:shadow-emerald-500/5 hover:-translate-y-1"
                                                >
                                                    {wf.thumbnail ? (
                                                        <img src={wf.thumbnail} loading="lazy" decoding="async" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" alt={wf.title} />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-black/40 text-zinc-600">
                                                            <WorkflowIcon size={32} />
                                                        </div>
                                                    )}

                                                    {/* Hover 磨砂按钮覆盖层 */}
                                                    <div className="absolute inset-0 bg-black/45 backdrop-blur-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-3 p-4">
                                                        <button 
                                                            onClick={(e) => { 
                                                                e.stopPropagation();
                                                                onSelectWorkflow(wf.id);
                                                                setActivePanel(null);
                                                            }}
                                                            className="px-4 py-2 rounded-full bg-emerald-500/80 hover:bg-emerald-500 border border-emerald-400/30 text-xs font-bold text-white transition-all shadow-lg shadow-emerald-500/10 active:scale-95 animate-in slide-in-from-bottom-2 duration-300"
                                                        >
                                                            加载此工作流
                                                        </button>
                                                        <button 
                                                            onClick={(e) => { 
                                                                e.stopPropagation();
                                                                setEditingWorkflowId(wf.id);
                                                            }}
                                                            className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-md text-xs font-bold text-white transition-all shadow-md active:scale-95 animate-in slide-in-from-bottom-2 duration-300 delay-75"
                                                        >
                                                            重命名
                                                        </button>
                                                        <button 
                                                            onClick={(e) => { 
                                                                e.stopPropagation();
                                                                onDeleteWorkflow(wf.id);
                                                            }}
                                                            className="px-4 py-2 rounded-full bg-red-500/20 hover:bg-red-500/80 border border-red-500/30 text-xs font-bold text-red-400 hover:text-white transition-all shadow-md active:scale-95 animate-in slide-in-from-bottom-2 duration-300 delay-100"
                                                        >
                                                            删除工作流
                                                        </button>
                                                    </div>

                                                    {/* 节点数标签 */}
                                                    <div className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[9px] font-bold text-white/70 border border-white/5">
                                                        ⚙️ {wf.nodes.length} 节点
                                                    </div>

                                                    {/* 底部信息与重命名编辑 */}
                                                    <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/95 via-black/50 to-transparent text-[11px] font-bold text-zinc-200 group-hover:text-white truncate flex items-center leading-normal">
                                                        {editingWorkflowId === wf.id ? (
                                                            <input 
                                                                className="bg-black/50 border border-emerald-500/50 rounded px-2 py-0.5 text-xs text-white w-full outline-none"
                                                                defaultValue={wf.title}
                                                                autoFocus
                                                                onClick={(e) => e.stopPropagation()}
                                                                onBlur={(e) => { onRenameWorkflow(wf.id, e.target.value); setEditingWorkflowId(null); }}
                                                                onKeyDown={(e) => { if(e.key === 'Enter') { onRenameWorkflow(wf.id, e.currentTarget.value); setEditingWorkflowId(null); } }}
                                                            />
                                                        ) : (
                                                            wf.title
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}

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
