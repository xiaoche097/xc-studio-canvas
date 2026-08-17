
import React, { useState, useRef, useEffect } from 'react';
import { 
    Plus, RotateCcw, History, MessageSquare, FolderHeart, X, 
    ImageIcon, Video as VideoIcon, Film, Save, FolderPlus, 
    Edit, Trash2, Box, ScanFace, Brush, Type, Workflow as WorkflowIcon,
    Clapperboard, Mic2, Settings, Globe, Layers, Upload, Volume2,
    Eye, Sparkles, Search, ChevronLeft, MoreHorizontal, SlidersHorizontal,
    Clock3, LayoutGrid, Folder, FolderOpen, ArrowUpDown, Play
} from 'lucide-react';
import { NodeType, Workflow } from '../types';
import { OFFICIAL_MODELS, modelLibrary, ModelItem } from '../../Cyzx4/services/modelLibrary';
import { loadFromStorage, saveToStorage } from '../services/storage';

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

type AssetCollectionCategory = '人物' | '场景' | '物品' | '风格' | '商品' | '其他';

interface AssetCollection {
    id: string;
    name: string;
    category: AssetCollectionCategory;
}

interface AssetCollectionItem {
    id: string;
    collectionId: string;
    title: string;
    src: string;
    type: 'image' | 'video';
    createdAt: number;
}

const COLLECTION_ASSETS_STORAGE_KEY = 'xiaoche_asset_collection_items';

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
    const [activeMainTab, setActiveMainTab] = useState<'material' | 'avatar' | 'my_asset'>('my_asset');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMaterialCategory, setSelectedMaterialCategory] = useState('视频');
    const [selectedAvatarCategory, setSelectedAvatarCategory] = useState('角色套图');
    const [selectedAvatarSuite, setSelectedAvatarSuite] = useState<any | null>(null);
    const [selectedMyAssetCategory, setSelectedMyAssetCategory] = useState('全部');
    const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false);
    const [newCollectionName, setNewCollectionName] = useState('');
    const [newCollectionCategory, setNewCollectionCategory] = useState<AssetCollectionCategory>('人物');
    const [isAssetManageMode, setIsAssetManageMode] = useState(false);
    const [assetSortNewestFirst, setAssetSortNewestFirst] = useState(true);
    const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
    const [collectionAssets, setCollectionAssets] = useState<AssetCollectionItem[]>([]);
    const [isUploadingCollectionAssets, setIsUploadingCollectionAssets] = useState(false);
    const collectionFileInputRef = useRef<HTMLInputElement>(null);
    const [assetCollections, setAssetCollections] = useState<AssetCollection[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('xiaoche_asset_collections') || '[]');
        } catch {
            return [];
        }
    });

    const [avatarSuites, setAvatarSuites] = useState<any[]>(DEFAULT_AVATAR_SUITES);
    const [avatars, setAvatars] = useState<any[]>(DEFAULT_AVATARS);

    useEffect(() => {
        let active = true;
        loadFromStorage<AssetCollectionItem[]>(COLLECTION_ASSETS_STORAGE_KEY)
            .then((items) => {
                if (active && Array.isArray(items)) setCollectionAssets(items);
            })
            .catch((error) => console.warn('加载资源集资产失败:', error));
        return () => { active = false; };
    }, []);

    const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('文件读取失败'));
        reader.readAsDataURL(file);
    });

    const uploadAssetsToCollection = async (files: FileList | null) => {
        if (!files?.length || !selectedCollectionId || isUploadingCollectionAssets) return;
        setIsUploadingCollectionAssets(true);
        try {
            const uploaded = await Promise.all(Array.from(files).map(async (file, index) => ({
                id: `collection-asset-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
                collectionId: selectedCollectionId,
                title: file.name.replace(/\.[^/.]+$/, '') || `资产 ${index + 1}`,
                src: await readFileAsDataUrl(file),
                type: file.type.startsWith('video/') ? 'video' as const : 'image' as const,
                createdAt: Date.now() + index,
            })));
            const next = [...collectionAssets, ...uploaded];
            setCollectionAssets(next);
            await saveToStorage(COLLECTION_ASSETS_STORAGE_KEY, next);
        } catch (error) {
            console.error('上传资源集资产失败:', error);
        } finally {
            setIsUploadingCollectionAssets(false);
            if (collectionFileInputRef.current) collectionFileInputRef.current.value = '';
        }
    };

    const createAssetCollection = () => {
        const name = newCollectionName.trim();
        if (!name) return;
        const next = [
            ...assetCollections,
            { id: `collection-${Date.now()}`, name, category: newCollectionCategory },
        ];
        localStorage.setItem('xiaoche_asset_collections', JSON.stringify(next));
        // 先关闭二级弹层，再在下一帧更新底层网格，避免 Chromium 在双层
        // backdrop-filter 与大面积布局同时变化时出现短暂白闪。
        setIsCreateCollectionOpen(false);
        window.requestAnimationFrame(() => {
            setAssetCollections(next);
            setNewCollectionName('');
            setNewCollectionCategory('人物');
        });
    };

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
                    if (selectedMyAssetCategory === '商品') return matchesSearch && (a.title && /商品|产品/.test(a.title));
                    if (selectedMyAssetCategory === '其他') return matchesSearch && !(a.title && /人物|场景|物品|风格|商品|产品/.test(a.title));
                    return matchesSearch;
                }).sort((a, b) => {
                    const aTime = Number(a.createdAt || a.timestamp || 0);
                    const bTime = Number(b.createdAt || b.timestamp || 0);
                    return assetSortNewestFirst ? bTime - aTime : aTime - bTime;
                });
                const selectedCollection = assetCollections.find((item) => item.id === selectedCollectionId);
                const selectedCollectionAssets = collectionAssets
                    .filter((item) => item.collectionId === selectedCollectionId)
                    .filter((item) => item.title.toLowerCase().includes(searchQuery.toLowerCase()))
                    .sort((a, b) => assetSortNewestFirst ? b.createdAt - a.createdAt : a.createdAt - b.createdAt);

                return (
                    <div 
                        className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-lg flex items-center justify-center p-4 sm:p-7 animate-in fade-in duration-300"
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        {/* 背景点击关闭 */}
                        <div className="absolute inset-0" onClick={() => setActivePanel(null)} />
                        
                        {/* 弹窗核心容器 */}
                        <div 
                            className="relative w-full max-w-[1500px] h-[86vh] min-h-[620px] bg-[radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.09),transparent_32%),linear-gradient(145deg,#1b1b1e_0%,#151517_72%)] backdrop-blur-3xl border border-white/[0.09] rounded-[24px] shadow-[0_32px_100px_rgba(0,0,0,0.72)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 text-left"
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            {/* 顶部标签式大导航栏 */}
                            <div className="flex gap-5 px-5 sm:px-7 pt-5 pb-3 items-center justify-between shrink-0">
                                <div className="flex min-w-0 items-center gap-4">
                                    <div className="flex bg-black/25 p-1 rounded-xl border border-white/[0.08]">
                                        {[
                                            { id: 'my_asset', label: '我的资产' },
                                            { id: 'material', label: '素材库' },
                                            { id: 'avatar', label: '虚拟人像库' }
                                        ].map(tab => (
                                            <button
                                                key={tab.id}
                                                onClick={() => {
                                                    setActiveMainTab(tab.id as any);
                                                    setSearchQuery(''); // 切换时清空搜索
                                                    setSelectedAvatarSuite(null);
                                                    setSelectedCollectionId(null);
                                                }}
                                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${activeMainTab === tab.id ? 'bg-[#2a2c31] text-white shadow-[0_4px_16px_rgba(0,0,0,0.3)] ring-1 ring-white/5' : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200'}`}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                
                                {/* 搜索与关闭按钮 */}
                                <div className="flex shrink-0 items-center gap-3">
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
                                            className="w-52 sm:w-64 bg-black/20 border border-white/[0.08] rounded-full pl-9 pr-8 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-lime-400/50 focus:ring-2 focus:ring-lime-400/10 transition-all font-medium"
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
                                        className="p-2 text-zinc-500 hover:text-white hover:bg-white/[0.07] rounded-full transition-all"
                                    >
                                        <X size={15} />
                                    </button>
                                </div>
                            </div>

                            {/* 子类别药丸 Pill 选择器 */}
                            {!(activeMainTab === 'my_asset' && selectedCollectionId) && (
                            <div className="flex items-center justify-between gap-4 px-5 sm:px-7 py-3 border-b border-white/[0.055] overflow-x-auto shrink-0 custom-scrollbar">
                                <div className="flex min-w-max items-center gap-2">
                                {/* 素材库小标签 */}
                                {activeMainTab === 'material' && ['视频', '全景', '长图', '服装', '宠物', '场景', '抠图'].map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setSelectedMaterialCategory(cat)}
                                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 ${selectedMaterialCategory === cat ? 'bg-lime-400/10 text-lime-300 border-lime-400/40' : 'bg-white/[0.015] text-zinc-500 border-white/[0.07] hover:text-zinc-300 hover:border-white/15'}`}
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
                                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 ${selectedAvatarCategory === cat ? 'bg-lime-400/10 text-lime-300 border-lime-400/40' : 'bg-white/[0.015] text-zinc-500 border-white/[0.07] hover:text-zinc-300 hover:border-white/15'}`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                                
                                {/* 我的资产小标签 */}
                                {activeMainTab === 'my_asset' && ['全部', '人物', '场景', '物品', '风格', '商品', '其他'].map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setSelectedMyAssetCategory(cat)}
                                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 ${selectedMyAssetCategory === cat ? 'bg-lime-400/10 text-lime-300 border-lime-400/40' : 'bg-white/[0.015] text-zinc-500 border-white/[0.07] hover:text-zinc-300 hover:border-white/15'}`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                                </div>
                                {activeMainTab === 'my_asset' && (
                                    <div className="ml-auto flex shrink-0 items-center gap-2">
                                        <button type="button" onClick={() => setIsCreateCollectionOpen(true)} className="flex h-9 items-center gap-2 rounded-lg bg-white/[0.12] px-3.5 text-xs font-bold text-zinc-100 hover:bg-white/[0.18] transition">
                                            <FolderPlus size={14} /> 新建资源集
                                        </button>
                                        <button type="button" onClick={() => setIsAssetManageMode((value) => !value)} className={`flex h-9 items-center gap-2 rounded-lg px-3.5 text-xs font-bold transition ${isAssetManageMode ? 'bg-lime-400 text-black' : 'bg-white/[0.12] text-zinc-100 hover:bg-white/[0.18]'}`}>
                                            <SlidersHorizontal size={14} /> {isAssetManageMode ? '完成' : '管理'}
                                        </button>
                                        <button type="button" onClick={() => setAssetSortNewestFirst((value) => !value)} className="flex h-9 items-center gap-2 rounded-lg bg-white/[0.12] px-3.5 text-xs font-bold text-zinc-100 hover:bg-white/[0.18] transition" title={assetSortNewestFirst ? '当前：最新优先' : '当前：最早优先'}>
                                            <Clock3 size={14} /> 时间 <ArrowUpDown size={12} className="text-zinc-400" />
                                        </button>
                                    </div>
                                )}
                            </div>
                            )}

                            {/* 核心卡片列表滚动区域 */}
                            <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-5 custom-scrollbar">
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
                                        <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 gap-3.5">
                                            {filteredMaterials.map((m, index) => (
                                                 <div 
                                                    key={m.id}
                                                    onClick={() => {
                                                        onHistoryItemClick(m);
                                                        setActivePanel(null); // 添加后自动关闭弹窗
                                                    }}
                                                    className={`relative mb-3.5 break-inside-avoid rounded-[14px] overflow-hidden border border-white/[0.07] bg-zinc-900/50 hover:border-lime-400/45 transition-all duration-300 group cursor-pointer shadow-lg hover:shadow-lime-400/5 hover:-translate-y-0.5 ${index % 5 === 0 ? 'aspect-[4/5]' : index % 3 === 0 ? 'aspect-square' : 'aspect-[3/4]'}`}
                                                >
                                                    {m.type === 'video' ? (
                                                        <video src={m.src} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100" loop muted playsInline />
                                                    ) : (
                                                        <img src={m.src} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100" alt={m.title} />
                                                    )}
                                                    {/* 类型标签 */}
                                                    <div className="absolute top-2.5 right-2.5 px-2 py-1 rounded-md bg-black/55 backdrop-blur-md text-[9px] font-bold text-white/75 border border-white/10">
                                                        {m.type === 'video' ? '🎥 视频' : '📷 图片'}
                                                    </div>
                                                    {/* 底部信息高光条 */}
                                                    <div className="absolute bottom-0 left-0 w-full px-3 pb-3 pt-10 bg-gradient-to-t from-black/95 via-black/45 to-transparent text-[11px] font-semibold text-zinc-200 group-hover:text-white truncate flex items-center">
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
                                    <div className="space-y-6">
                                        {selectedCollectionId && selectedCollection ? (
                                            <section>
                                                <div className="mb-5 flex items-center justify-between">
                                                    <button type="button" onClick={() => setSelectedCollectionId(null)} className="flex items-center gap-3 rounded-xl px-2 py-2 text-left text-zinc-300 hover:bg-white/[0.04] hover:text-white transition">
                                                        <ChevronLeft size={19} />
                                                        <span>
                                                            <span className="block text-base font-black">{selectedCollection.name}</span>
                                                            <span className="mt-0.5 block text-[10px] font-medium text-zinc-600">{selectedCollection.category} · {selectedCollectionAssets.length} 项资产</span>
                                                        </span>
                                                    </button>
                                                    <button type="button" onClick={() => collectionFileInputRef.current?.click()} disabled={isUploadingCollectionAssets} className="flex h-9 items-center gap-2 rounded-lg bg-lime-400 px-4 text-xs font-black text-black hover:bg-lime-300 disabled:opacity-50 transition">
                                                        <Upload size={14} /> {isUploadingCollectionAssets ? '上传中…' : '上传资产'}
                                                    </button>
                                                </div>

                                                <input
                                                    ref={collectionFileInputRef}
                                                    type="file"
                                                    accept="image/*,video/*"
                                                    multiple
                                                    className="hidden"
                                                    onChange={(event) => void uploadAssetsToCollection(event.target.files)}
                                                />

                                                <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                                                    <button
                                                        type="button"
                                                        onClick={() => collectionFileInputRef.current?.click()}
                                                        disabled={isUploadingCollectionAssets}
                                                        className="group flex aspect-[3/4] flex-col items-center justify-center gap-3 rounded-[16px] border border-dashed border-lime-400/65 bg-lime-400/[0.035] text-lime-300 hover:border-lime-300 hover:bg-lime-400/[0.07] disabled:opacity-50 transition"
                                                    >
                                                        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-lime-400/45 bg-lime-400/10 group-hover:scale-105 transition"><Plus size={23} /></span>
                                                        <span className="text-xs font-black">{isUploadingCollectionAssets ? '正在上传' : '上传资产'}</span>
                                                        <span className="text-[9px] font-medium text-zinc-600">支持图片和视频，可多选</span>
                                                    </button>

                                                    {selectedCollectionAssets.map((asset) => (
                                                        <div key={asset.id} onClick={() => { onHistoryItemClick(asset); setActivePanel(null); }} className="group relative aspect-[3/4] cursor-pointer overflow-hidden rounded-[16px] border border-white/[0.07] bg-zinc-900 hover:border-lime-400/45 transition">
                                                            {asset.type === 'video' ? (
                                                                <video src={asset.src} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" muted playsInline />
                                                            ) : (
                                                                <img src={asset.src} alt={asset.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                                                            )}
                                                            <span className="absolute left-2.5 top-2.5 rounded-md border border-white/10 bg-black/55 px-2 py-1 text-[9px] font-bold text-white/75 backdrop-blur-md">{asset.type === 'video' ? '视频' : '图片'}</span>
                                                            <button
                                                                type="button"
                                                                onClick={async (event) => {
                                                                    event.stopPropagation();
                                                                    const next = collectionAssets.filter((item) => item.id !== asset.id);
                                                                    setCollectionAssets(next);
                                                                    await saveToStorage(COLLECTION_ASSETS_STORAGE_KEY, next);
                                                                }}
                                                                className="absolute right-2.5 top-2.5 rounded-lg border border-white/10 bg-black/55 p-1.5 text-zinc-300 opacity-0 hover:bg-red-500/25 hover:text-red-300 group-hover:opacity-100 transition"
                                                                aria-label={`删除 ${asset.title}`}
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                            <div className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black via-black/65 to-transparent px-3 pb-3 pt-10 text-[11px] font-bold text-white">{asset.title}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </section>
                                        ) : (
                                        <>
                                        {assetCollections.length > 0 && selectedMyAssetCategory === '全部' && !searchQuery && (
                                            <section>
                                                <div className="mb-3 flex items-center justify-between">
                                                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                                                        <FolderOpen size={14} className="text-lime-300" /> 资源集
                                                        <span className="font-medium text-zinc-600">{assetCollections.length}</span>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                                                    {assetCollections.map((collection) => (
                                                        <button key={collection.id} type="button" onClick={() => setSelectedCollectionId(collection.id)} className="group flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.035] p-3 text-left hover:border-lime-400/30 hover:bg-white/[0.06] transition">
                                                            <span className="flex h-10 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-lime-300/20 to-emerald-400/5 text-lime-300 ring-1 ring-lime-300/15">
                                                                <Folder size={19} />
                                                            </span>
                                                            <span className="min-w-0 flex-1">
                                                                <span className="block truncate text-xs font-bold text-zinc-200 group-hover:text-white">{collection.name}</span>
                                                                <span className="mt-1 block text-[10px] text-zinc-600">{collection.category} · {collectionAssets.filter((asset) => asset.collectionId === collection.id).length} 项</span>
                                                            </span>
                                                            {isAssetManageMode && (
                                                                <span
                                                                    role="button"
                                                                    tabIndex={0}
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        const next = assetCollections.filter((item) => item.id !== collection.id);
                                                                        setAssetCollections(next);
                                                                        localStorage.setItem('xiaoche_asset_collections', JSON.stringify(next));
                                                                    }}
                                                                    className="rounded-md p-1.5 text-zinc-600 hover:bg-red-500/10 hover:text-red-400"
                                                                    aria-label={`删除资源集 ${collection.name}`}
                                                                >
                                                                    <Trash2 size={13} />
                                                                </span>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            </section>
                                        )}

                                        {filteredMyAssets.length === 0 ? (
                                            <div className="flex min-h-[48vh] flex-col items-center justify-center select-none">
                                                <div className="relative mb-6 flex h-24 w-28 items-center justify-center">
                                                    <div className="absolute inset-x-3 bottom-1 h-12 rounded-[16px] border border-white/10 bg-gradient-to-b from-zinc-700/70 to-zinc-950 shadow-[0_18px_40px_rgba(0,0,0,0.55)]" />
                                                    <div className="absolute left-3 top-6 flex h-12 w-12 -rotate-6 items-center justify-center rounded-xl border border-white/10 bg-[#27272a] text-zinc-300 shadow-xl"><ImageIcon size={21} /></div>
                                                    <div className="absolute left-[42px] top-0 flex h-12 w-12 rotate-3 items-center justify-center rounded-xl border border-white/10 bg-[#303034] text-zinc-200 shadow-xl"><Film size={21} /></div>
                                                    <div className="absolute right-2 top-7 flex h-11 w-11 rotate-6 items-center justify-center rounded-xl border border-white/10 bg-[#242427] text-zinc-300 shadow-xl"><Sparkles size={19} /></div>
                                                </div>
                                                <h3 className="text-base font-black text-white">{searchQuery ? '没有找到匹配的资产' : assetCollections.length ? '这个资源集还是空的' : '还没有资源集'}</h3>
                                                <p className="mt-2 max-w-sm text-center text-xs leading-5 text-zinc-500">{searchQuery ? '试试更换关键词或切换分类。' : assetCollections.length ? '生成内容或从素材库添加资产后，可以继续按创作主题整理。' : '把角色、场景、商品和风格素材整理成资源集，创作时查找会更快。'}</p>
                                                {!searchQuery && assetCollections.length === 0 && (
                                                    <button type="button" onClick={() => setIsCreateCollectionOpen(true)} className="mt-5 flex h-10 items-center gap-2 rounded-xl bg-lime-400 px-5 text-xs font-black text-black shadow-[0_10px_28px_rgba(163,230,53,0.15)] hover:bg-lime-300 active:scale-95 transition">
                                                        <FolderPlus size={15} /> 创建资源集
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                        <section>
                                            <div className="mb-3 flex items-center gap-2 text-xs font-bold text-zinc-300">
                                                <LayoutGrid size={14} className="text-zinc-500" /> 资产
                                                <span className="font-medium text-zinc-600">{filteredMyAssets.length}</span>
                                            </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
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
                                                    className="relative aspect-[3/4] rounded-[14px] overflow-hidden border border-white/[0.07] bg-zinc-900/50 hover:border-lime-400/45 transition-all duration-300 group cursor-pointer shadow-lg hover:shadow-lime-400/5 hover:-translate-y-0.5"
                                                >
                                                    {a.type.includes('video') ? (
                                                        <video src={a.src} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100" loop muted playsInline />
                                                    ) : (
                                                        <img src={a.src} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100" alt={a.title} />
                                                    )}
                                                    {/* 类型标签 */}
                                                    <div className="absolute top-2.5 left-2.5 px-2 py-1 rounded-md bg-black/55 backdrop-blur-md text-[9px] font-bold text-white/75 border border-white/10">
                                                        {a.type.includes('video') ? '🎥 视频' : '📷 图片'}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            setContextMenu({ visible: true, x: event.clientX - 110, y: event.clientY + 8, id: a.id, type: 'history' });
                                                        }}
                                                        className="absolute right-2.5 top-2.5 rounded-lg border border-white/10 bg-black/55 p-1.5 text-zinc-300 opacity-0 backdrop-blur-md hover:bg-black/80 hover:text-white group-hover:opacity-100 transition"
                                                        aria-label="资产操作"
                                                    >
                                                        <MoreHorizontal size={14} />
                                                    </button>
                                                    {/* 底部信息高光条 */}
                                                    <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/95 via-black/50 to-transparent text-[11px] font-semibold text-zinc-200 group-hover:text-white truncate flex items-center">
                                                        {a.title || '已生成资产'}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        </section>
                                        )}
                                        </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {isCreateCollectionOpen && (
                            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/75 p-4" onMouseDown={(event) => event.stopPropagation()}>
                                <div className="w-full max-w-[470px] rounded-[22px] border border-white/10 bg-[#121214] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.75)] animate-in fade-in duration-150">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-xl font-black text-white">新建资源集</h3>
                                            <p className="mt-1 text-xs text-zinc-600">为同一角色、商品或创作主题集中管理素材</p>
                                        </div>
                                        <button type="button" onClick={() => setIsCreateCollectionOpen(false)} className="rounded-lg p-2 text-zinc-500 hover:bg-white/[0.06] hover:text-white transition" aria-label="关闭">
                                            <X size={17} />
                                        </button>
                                    </div>

                                    <label className="mt-6 block text-[11px] font-bold text-zinc-400">资源集名称</label>
                                    <input
                                        autoFocus
                                        type="text"
                                        value={newCollectionName}
                                        onChange={(event) => setNewCollectionName(event.target.value)}
                                        onKeyDown={(event) => event.key === 'Enter' && createAssetCollection()}
                                        placeholder="例如：夏季新品模特组"
                                        className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm font-semibold text-white outline-none placeholder:text-zinc-700 focus:border-lime-400/70 focus:ring-2 focus:ring-lime-400/10 transition"
                                    />

                                    <p className="mt-5 text-[11px] font-bold text-zinc-400">选择资源集类型</p>
                                    <div className="mt-2.5 flex flex-wrap gap-2">
                                        {(['人物', '场景', '物品', '风格', '商品', '其他'] as AssetCollectionCategory[]).map((category) => (
                                            <button
                                                key={category}
                                                type="button"
                                                onClick={() => setNewCollectionCategory(category)}
                                                className={`rounded-lg border px-3.5 py-2 text-xs font-bold transition ${newCollectionCategory === category ? 'border-lime-400 bg-lime-400 text-black shadow-[0_6px_18px_rgba(163,230,53,0.12)]' : 'border-white/[0.08] bg-white/[0.035] text-zinc-400 hover:border-white/15 hover:text-zinc-200'}`}
                                            >
                                                {category}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="mt-7 grid grid-cols-2 gap-3">
                                        <button type="button" onClick={() => setIsCreateCollectionOpen(false)} className="h-12 rounded-xl bg-white/[0.065] text-sm font-bold text-zinc-300 hover:bg-white/[0.1] transition">取消</button>
                                        <button type="button" disabled={!newCollectionName.trim()} onClick={createAssetCollection} className="h-12 rounded-xl bg-lime-400 text-sm font-black text-black hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-35 transition">创建资源集</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* 工作流中心大弹窗 (AIGC 工作流中心) */}
            {activePanel === 'workflow' && (() => {
                // 根据当前选中分类和搜索词进行实时过滤
                const filteredTemplates: Array<{ id: string; title: string; src: string; category: string }> = [];

                const filteredUserWorkflows = [...workflows].filter(w => {
                    const matchesSearch = w.title.toLowerCase().includes(workflowSearchQuery.toLowerCase());
                    return matchesSearch;
                }).sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
                const totalWorkflowNodes = workflows.reduce((total, workflow) => total + workflow.nodes.length, 0);

                return (
                    <div 
                        className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-lg flex items-center justify-center p-4 sm:p-7 animate-in fade-in duration-300"
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        {/* 背景点击关闭 */}
                        <div className="absolute inset-0" onClick={() => setActivePanel(null)} />
                        
                        {/* 弹窗核心容器 */}
                        <div 
                            className="relative w-full max-w-[1500px] h-[86vh] min-h-[600px] bg-[radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.08),transparent_34%),linear-gradient(145deg,#1b1b1e,#151517_72%)] border border-white/[0.09] rounded-[24px] shadow-[0_32px_100px_rgba(0,0,0,0.75)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 text-left"
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            {/* 顶部标签式大导航栏 */}
                            <div className="flex gap-5 px-5 sm:px-7 pt-5 pb-3 items-center justify-between shrink-0">
                                <div className="flex min-w-0 items-center gap-4">
                                    <div className="flex bg-black/25 p-1 rounded-xl border border-white/[0.08]">
                                        {[
                                            { id: 'my_workflow', label: '我的工作流' }
                                        ].map(tab => (
                                            <button
                                                key={tab.id}
                                                onClick={() => {
                                                    setWorkflowSearchQuery('');
                                                }}
                                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${activeWorkflowMainTab === tab.id ? 'bg-[#2a2c31] text-white shadow-[0_4px_16px_rgba(0,0,0,0.3)] ring-1 ring-white/5' : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200'}`}
                                            >
                                                {tab.label}
                                                <span className="text-[9px] text-lime-300">{workflows.length}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                
                                {/* 搜索与关闭按钮 */}
                                <div className="flex shrink-0 items-center gap-3">
                                    <button type="button" onClick={onSaveWorkflow} className="flex h-9 items-center gap-2 rounded-lg bg-lime-400 px-4 text-xs font-black text-black hover:bg-lime-300 active:scale-95 transition">
                                        <Save size={14} /> 保存当前画布
                                    </button>
                                    <div className="relative flex items-center">
                                        <Search size={14} className="absolute left-3 text-zinc-500" />
                                        <input
                                            type="text"
                                            value={workflowSearchQuery}
                                            onChange={(e) => setWorkflowSearchQuery(e.target.value)}
                                            placeholder="搜索我的工作流..."
                                            className="w-52 sm:w-64 bg-black/20 border border-white/[0.08] rounded-full pl-9 pr-8 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-lime-400/50 focus:ring-2 focus:ring-lime-400/10 transition-all font-medium"
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
                                        className="p-2 text-zinc-500 hover:text-white hover:bg-white/[0.07] rounded-full transition-all"
                                    >
                                        <X size={15} />
                                    </button>
                                </div>
                            </div>

                            {activeWorkflowMainTab === 'my_workflow' && (
                                <div className="flex items-center gap-4 border-b border-white/[0.055] px-5 py-3 sm:px-7">
                                    <span className="flex items-center gap-2 rounded-lg border border-lime-400/25 bg-lime-400/10 px-3.5 py-1.5 text-xs font-bold text-lime-300">全部工作流</span>
                                    <span className="text-[11px] font-medium text-zinc-600">{workflows.length} 个工作流</span>
                                    <span className="h-3 w-px bg-white/[0.08]" />
                                    <span className="text-[11px] font-medium text-zinc-600">共 {totalWorkflowNodes} 个节点</span>
                                </div>
                            )}

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
                            <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-5 custom-scrollbar">
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
                                        <div className="flex min-h-[52vh] flex-col items-center justify-center text-zinc-500 select-none col-span-full">
                                            <div className="relative mb-5 flex h-20 w-24 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.035] shadow-[0_18px_45px_rgba(0,0,0,0.35)]">
                                                <WorkflowIcon size={28} className="text-lime-300/70" />
                                                <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-lime-400/25 bg-[#1d2118] text-lime-300"><Plus size={14} /></span>
                                            </div>
                                            <span className="text-sm font-black text-white">还没有保存的工作流</span>
                                            <span className="mt-2 max-w-sm text-center text-[11px] leading-5 text-zinc-600">将调试完成的分组直接保存，或保存当前完整画布，之后可随时加载和拖回画布复用。</span>
                                            <button
                                                type="button"
                                                onClick={onSaveWorkflow}
                                                className="mt-5 flex items-center gap-2 rounded-xl bg-lime-400 px-5 py-2.5 text-xs font-black text-black transition-all hover:bg-lime-300 active:scale-95"
                                            >
                                                <Save size={14} />
                                                保存当前画布
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
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
                                                    className="group flex cursor-pointer flex-col overflow-hidden rounded-[16px] border border-white/[0.07] bg-[#111114]/85 shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:border-lime-400/40 hover:shadow-lime-400/5"
                                                >
                                                    <div className="relative aspect-[4/3] overflow-hidden bg-black/35">
                                                        {wf.thumbnail ? (
                                                            <img src={wf.thumbnail} loading="lazy" decoding="async" className="h-full w-full object-cover opacity-90 transition duration-500 group-hover:scale-105 group-hover:opacity-100" alt={wf.title} />
                                                        ) : (
                                                            <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_45%,rgba(163,230,53,0.12),transparent_38%),linear-gradient(145deg,#202124,#111113)] text-zinc-600">
                                                                <div className="absolute left-[22%] top-[28%] h-8 w-12 rounded-lg border border-lime-400/20 bg-lime-400/[0.06]" />
                                                                <div className="absolute right-[20%] top-[46%] h-8 w-12 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05]" />
                                                                <div className="absolute left-[35%] top-[43%] h-px w-[30%] -rotate-6 bg-white/15" />
                                                                <WorkflowIcon size={28} className="relative text-zinc-500" />
                                                            </div>
                                                        )}
                                                        <div className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition group-hover:opacity-100">
                                                            <button type="button" onClick={(event) => { event.stopPropagation(); onSelectWorkflow(wf.id); setActivePanel(null); }} className="flex items-center gap-2 rounded-xl bg-lime-400 px-4 py-2 text-xs font-black text-black shadow-xl hover:bg-lime-300 active:scale-95 transition">
                                                                <Play size={13} fill="currentColor" /> 加载工作流
                                                            </button>
                                                        </div>
                                                        <span className="absolute left-2.5 top-2.5 rounded-md border border-white/10 bg-black/55 px-2 py-1 text-[9px] font-bold text-white/75 backdrop-blur-md">{wf.nodes.length} 节点</span>
                                                    </div>
                                                    <div className="flex min-h-[58px] items-center gap-2 border-t border-white/[0.055] px-3 py-2.5">
                                                        {editingWorkflowId === wf.id ? (
                                                            <input 
                                                                className="min-w-0 flex-1 rounded-lg border border-lime-400/50 bg-black/40 px-2.5 py-1.5 text-xs font-bold text-white outline-none"
                                                                defaultValue={wf.title}
                                                                autoFocus
                                                                onClick={(e) => e.stopPropagation()}
                                                                onBlur={(e) => { onRenameWorkflow(wf.id, e.target.value); setEditingWorkflowId(null); }}
                                                                onKeyDown={(e) => { if(e.key === 'Enter') { onRenameWorkflow(wf.id, e.currentTarget.value); setEditingWorkflowId(null); } }}
                                                            />
                                                        ) : (
                                                            <div className="min-w-0 flex-1">
                                                                <p className="truncate text-xs font-bold text-zinc-200 group-hover:text-white">{wf.title}</p>
                                                                <p className="mt-1 text-[9px] font-medium text-zinc-600">{wf.connections.length} 条连接 · {wf.groups.length} 个分组</p>
                                                            </div>
                                                        )}
                                                        <button type="button" onClick={(event) => { event.stopPropagation(); setEditingWorkflowId(wf.id); }} className="rounded-lg p-1.5 text-zinc-600 hover:bg-white/[0.06] hover:text-zinc-200 transition" title="重命名"><Edit size={13} /></button>
                                                        <button type="button" onClick={(event) => { event.stopPropagation(); if (window.confirm(`确定删除工作流“${wf.title}”吗？`)) onDeleteWorkflow(wf.id); }} className="rounded-lg p-1.5 text-zinc-600 hover:bg-red-500/10 hover:text-red-400 transition" title="删除"><Trash2 size={13} /></button>
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
