import React, { useState, useRef, useEffect } from 'react';
import { 
    X, Trash2, Download, Play, Pause, CheckSquare, 
    Square, Music, Film, Image as ImageIcon, Loader2, Volume2, Inbox, RefreshCw 
} from 'lucide-react';

// 历史项的数据结构定义
interface HistoryItem {
    id: string;
    type: 'image' | 'video' | 'audio';
    src: string;
    title: string;
    timestamp: number;
}

interface HistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    assetHistory: HistoryItem[];
    onHistoryItemClick: (item: HistoryItem) => void;
    onDeleteAsset: (id: string) => void;
    onBatchDeleteAssets: (ids: string[]) => void;
}

type TabType = 'image' | 'video' | 'audio';

export const HistoryModal: React.FC<HistoryModalProps> = ({
    isOpen,
    onClose,
    assetHistory,
    onHistoryItemClick,
    onDeleteAsset,
    onBatchDeleteAssets
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('image');
    
    // 批量选择模式状态
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    
    // 音频播放状态管理
    const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
    const [audioCurrentTime, setAudioCurrentTime] = useState(0);
    const [audioDuration, setAudioDuration] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const progressIntervalRef = useRef<number | null>(null);

    // 监听 Escape 键关闭弹窗
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // 当关闭弹窗或切换 Tab 时，停止音频播放
    useEffect(() => {
        stopAudio();
    }, [isOpen, activeTab]);

    // 清理播放器定时器
    useEffect(() => {
        return () => {
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
        };
    }, []);

    if (!isOpen) return null;

    // 过滤出当前 Tab 类型对应的历史数据
    const filteredItems = assetHistory.filter(item => item.type === activeTab);

    // 切换单个项目的选择状态
    const toggleSelectItem = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    // 全选或取消全选当前列表下的所有项目
    const handleToggleSelectAll = () => {
        if (selectedIds.size === filteredItems.length) {
            // 当前已是全选状态，则清空选择
            setSelectedIds(new Set());
        } else {
            // 否则全选当前分类下的所有项目
            setSelectedIds(new Set(filteredItems.map(item => item.id)));
        }
    };

    // 退出批量选择模式
    const handleExitSelectionMode = () => {
        setIsSelectionMode(false);
        setSelectedIds(new Set());
    };

    // 执行批量删除
    const handleConfirmBatchDelete = () => {
        if (selectedIds.size === 0) return;
        if (window.confirm(`确定要删除选中的 ${selectedIds.size} 个历史记录吗？删除后将无法恢复。`)) {
            onBatchDeleteAssets(Array.from(selectedIds));
            setSelectedIds(new Set());
            setIsSelectionMode(false);
        }
    };

    // 下载单个资产到本地
    const handleDownload = (e: React.MouseEvent, item: HistoryItem) => {
        e.stopPropagation();
        try {
            const link = document.createElement('a');
            link.href = item.src;
            link.download = item.title ? `${item.title.substring(0, 20)}.${item.type === 'audio' ? 'mp3' : item.type === 'video' ? 'mp4' : 'png'}` : `aigc-asset-${item.id}.${item.type === 'audio' ? 'mp3' : item.type === 'video' ? 'mp4' : 'png'}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("下载失败", error);
            alert("下载失败，请重试");
        }
    };

    // 删除单个资产
    const handleDeleteSingle = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (window.confirm("确定要删除这条历史记录吗？")) {
            onDeleteAsset(id);
            // 从批量选中中剔除（如果包含）
            if (selectedIds.has(id)) {
                const newSelected = new Set(selectedIds);
                newSelected.delete(id);
                setSelectedIds(newSelected);
            }
        }
    };

    // 停止音频播放
    function stopAudio() {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        setPlayingAudioId(null);
        setAudioCurrentTime(0);
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }
    }

    // 音频播放/暂停控制
    const handleTogglePlayAudio = (e: React.MouseEvent, item: HistoryItem) => {
        e.stopPropagation();
        
        // 如果点击的是正在播放的音频，则暂停
        if (playingAudioId === item.id) {
            stopAudio();
            return;
        }

        // 停止之前的音频
        stopAudio();

        // 播放新音频
        const audio = new Audio(item.src);
        audioRef.current = audio;
        setPlayingAudioId(item.id);

        audio.addEventListener('loadedmetadata', () => {
            setAudioDuration(audio.duration || 0);
        });

        audio.addEventListener('ended', () => {
            stopAudio();
        });

        audio.play().catch(err => {
            console.error("音频播放失败", err);
            stopAudio();
        });

        // 启动时间更新计时器
        progressIntervalRef.current = window.setInterval(() => {
            if (audioRef.current) {
                setAudioCurrentTime(audioRef.current.currentTime);
                setAudioDuration(audioRef.current.duration || 0);
            }
        }, 100);
    };

    // 格式化时间显示 (秒 -> 分:秒)
    const formatTime = (time: number) => {
        if (isNaN(time)) return '0:00';
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    // 格式化时间戳显示
    const formatTimestamp = (ts: number) => {
        const date = new Date(ts);
        return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md transition-all duration-300 animate-in fade-in">
            {/* 弹窗主体内容卡片 */}
            <div 
                className="relative w-full max-w-5xl h-[80vh] bg-[#0c0c0e]/95 border border-white/10 rounded-[28px] shadow-[0_25px_60px_rgba(0,0,0,0.8)] backdrop-blur-3xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 顶部头部导航区域 */}
                <div className="p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold text-white tracking-wider flex items-center gap-2">
                            <span className="text-cyan-400">✨</span> 历史记录
                        </h2>
                        
                        {/* Tab 栏切换按钮组 */}
                        <div className="flex bg-white/5 p-1 rounded-full border border-white/5">
                            {[
                                { id: 'image', label: '图片历史', icon: ImageIcon },
                                { id: 'video', label: '视频历史', icon: Film },
                                { id: 'audio', label: '音频历史', icon: Music }
                            ].map(tab => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => {
                                            setActiveTab(tab.id as TabType);
                                            handleExitSelectionMode();
                                        }}
                                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${
                                            isActive 
                                                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md' 
                                                : 'text-zinc-400 hover:text-white'
                                        }`}
                                    >
                                        <Icon size={13} />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 右侧操作按钮组（普通状态 vs 批量状态） */}
                    <div className="flex items-center gap-3 self-end md:self-auto">
                        {isSelectionMode ? (
                            <div className="flex items-center gap-3 animate-in slide-in-from-right-4 duration-300">
                                <span className="text-xs text-cyan-400 font-semibold bg-cyan-400/10 px-3 py-1.5 rounded-full border border-cyan-400/20">
                                    已选 {selectedIds.size} 项
                                </span>
                                
                                <button
                                    onClick={handleToggleSelectAll}
                                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-full border border-white/5 text-xs text-zinc-300 font-medium transition-all"
                                >
                                    {selectedIds.size === filteredItems.length && filteredItems.length > 0 ? '取消全选' : '全选本页'}
                                </button>
                                
                                <button
                                    onClick={handleConfirmBatchDelete}
                                    disabled={selectedIds.size === 0}
                                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                                        selectedIds.size > 0
                                            ? 'bg-red-500/20 border-red-500/30 hover:bg-red-500/30 text-red-400'
                                            : 'bg-zinc-800/40 border-zinc-800/60 text-zinc-600 cursor-not-allowed'
                                    }`}
                                >
                                    <Trash2 size={12} />
                                    批量删除
                                </button>

                                <button
                                    onClick={handleExitSelectionMode}
                                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-full text-xs text-zinc-200 font-semibold transition-all"
                                >
                                    取消
                                </button>
                            </div>
                        ) : (
                            filteredItems.length > 0 && (
                                <button
                                    onClick={() => setIsSelectionMode(true)}
                                    className="flex items-center gap-1.5 px-4 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-full border border-white/5 text-xs font-semibold transition-all hover:scale-105"
                                >
                                    <CheckSquare size={13} className="text-cyan-400" />
                                    批量操作
                                </button>
                            )
                        )}

                        <div className="w-px h-5 bg-white/10 mx-1 hidden md:block"></div>

                        {/* 关闭按钮 */}
                        <button
                            onClick={onClose}
                            className="p-2 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-full border border-white/5 transition-all hover:rotate-90 duration-300"
                            title="关闭"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* 历史卡片列表区域 */}
                <div className="flex-1 overflow-y-auto p-8 no-scrollbar bg-[#09090b]/40">
                    {filteredItems.length > 0 ? (
                        <div className={`grid gap-5 ${
                            activeTab === 'audio' 
                                ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' 
                                : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
                        }`}>
                            {filteredItems.map(item => {
                                const isSelected = selectedIds.has(item.id);
                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => {
                                            if (isSelectionMode) {
                                                toggleSelectItem(item.id);
                                            } else {
                                                onHistoryItemClick(item);
                                            }
                                        }}
                                        className={`group relative flex flex-col bg-[#111115]/80 border rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 ${
                                            isSelected 
                                                ? 'border-cyan-500/80 shadow-[0_0_15px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/30' 
                                                : 'border-white/5 hover:border-white/20 hover:shadow-[0_10px_25px_rgba(0,0,0,0.5)]'
                                        }`}
                                    >
                                        {/* 1. 图片或视频卡片布局 */}
                                        {activeTab !== 'audio' ? (
                                            <div className="relative aspect-square bg-zinc-950 flex items-center justify-center overflow-hidden">
                                                {activeTab === 'image' ? (
                                                    <img 
                                                        src={item.src} 
                                                        alt={item.title}
                                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <div className="relative w-full h-full flex items-center justify-center">
                                                        <video 
                                                            src={item.src} 
                                                            className="w-full h-full object-cover"
                                                            muted
                                                            playsInline
                                                        />
                                                        {/* 视频专属徽章和播放图标 */}
                                                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                                            <div className="w-10 h-10 bg-black/60 rounded-full flex items-center justify-center border border-white/10 text-white group-hover:scale-110 transition-transform">
                                                                <Play size={16} fill="white" className="ml-0.5" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* 遮罩覆盖操作层 (非批量选择模式下悬浮显示) */}
                                                {!isSelectionMode && (
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-3.5">
                                                        {/* 卡片顶部的快捷下载删除动作 */}
                                                        <div className="flex justify-end gap-2">
                                                            <button
                                                                onClick={(e) => handleDownload(e, item)}
                                                                className="p-1.5 bg-black/60 hover:bg-cyan-500 text-white rounded-lg border border-white/5 hover:border-cyan-400 transition-all hover:scale-105"
                                                                title="下载到本地"
                                                            >
                                                                <Download size={12} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => handleDeleteSingle(e, item.id)}
                                                                className="p-1.5 bg-black/60 hover:bg-red-500 text-white rounded-lg border border-white/5 hover:border-red-400 transition-all hover:scale-105"
                                                                title="删除"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>

                                                        {/* 导入画布的主操作按钮 */}
                                                        <div className="space-y-1.5">
                                                            <div className="text-[10px] text-zinc-400 font-semibold">{formatTimestamp(item.timestamp)}</div>
                                                            <div className="w-full py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold rounded-lg text-center shadow-lg transition-all hover:from-cyan-400 hover:to-blue-500">
                                                                导入画布
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            /* 2. 音频卡片布局 (特殊精美的音乐卡片) */
                                            <div className="p-4 flex flex-col justify-between min-h-[140px] bg-zinc-900/40 relative overflow-hidden group/audio">
                                                {/* 流光幻彩背景渐变圈 */}
                                                <div className="absolute -right-10 -bottom-10 w-24 h-24 bg-gradient-to-tr from-cyan-500/10 to-blue-500/10 rounded-full blur-xl group-hover/audio:scale-150 transition-all duration-700 pointer-events-none"></div>
                                                
                                                <div className="flex items-start gap-3 relative z-10">
                                                    {/* 音频图标或正在播放按钮 */}
                                                    <button
                                                        onClick={(e) => handleTogglePlayAudio(e, item)}
                                                        className={`w-11 h-11 rounded-xl flex items-center justify-center border transition-all ${
                                                            playingAudioId === item.id
                                                                ? 'bg-cyan-500 border-cyan-400 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)] animate-pulse'
                                                                : 'bg-zinc-800 hover:bg-zinc-700 border-white/5 text-zinc-300'
                                                        }`}
                                                    >
                                                        {playingAudioId === item.id ? (
                                                            <Pause size={16} fill="currentColor" />
                                                        ) : (
                                                            <Play size={16} fill="currentColor" className="ml-0.5" />
                                                        )}
                                                    </button>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-bold text-zinc-300 truncate tracking-wide" title={item.title}>
                                                            {item.title || '灵感音乐'}
                                                        </div>
                                                        <div className="text-[10px] text-zinc-500 mt-0.5 font-semibold">
                                                            {formatTimestamp(item.timestamp)}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* 正在播放的进度条与时间显示 */}
                                                {playingAudioId === item.id ? (
                                                    <div className="mt-4 flex flex-col gap-1 animate-in fade-in duration-300 relative z-10">
                                                        <div className="w-full bg-zinc-800 rounded-full h-1 overflow-hidden">
                                                            <div 
                                                                className="bg-cyan-400 h-full rounded-full transition-all duration-100"
                                                                style={{ width: `${(audioCurrentTime / (audioDuration || 1)) * 100}%` }}
                                                            ></div>
                                                        </div>
                                                        <div className="flex justify-between text-[9px] text-zinc-400 font-bold mt-0.5">
                                                            <span>{formatTime(audioCurrentTime)}</span>
                                                            <span>{formatTime(audioDuration)}</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="mt-4 flex items-center justify-between text-[10px] text-zinc-500 font-bold border-t border-white/5 pt-2 relative z-10 opacity-60 group-hover:opacity-100 transition-opacity">
                                                        <span className="flex items-center gap-1"><Volume2 size={12} /> 音频资源</span>
                                                        {!isSelectionMode && (
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={(e) => handleDownload(e, item)}
                                                                    className="p-1 hover:text-cyan-400 hover:bg-white/5 rounded transition-all"
                                                                    title="下载音频"
                                                                >
                                                                    <Download size={12} />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => handleDeleteSingle(e, item.id)}
                                                                    className="p-1 hover:text-red-400 hover:bg-white/5 rounded transition-all"
                                                                    title="删除音频"
                                                                >
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* 勾选框覆盖层 (批量选择模式下显示) */}
                                        {isSelectionMode && (
                                            <div className="absolute top-3 left-3 z-10 bg-black/60 rounded-full p-0.5 border border-white/10 backdrop-blur-sm transition-all hover:scale-110">
                                                {isSelected ? (
                                                    <div className="w-4 h-4 bg-cyan-500 rounded-full flex items-center justify-center text-black">
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                                                            <path d="M20 6L9 17l-5-5" />
                                                        </svg>
                                                    </div>
                                                ) : (
                                                    <div className="w-4 h-4 rounded-full border-2 border-zinc-500"></div>
                                                )}
                                            </div>
                                        )}

                                        {/* 提示：点击即可导入画布 */}
                                        {!isSelectionMode && activeTab !== 'audio' && (
                                            <div className="p-2.5 bg-[#111115] border-t border-white/5 flex items-center justify-between text-[10px] text-zinc-500 font-semibold group-hover:text-cyan-400 transition-colors">
                                                <span className="truncate max-w-[80%]">{item.title || '创意图像'}</span>
                                                <span className="text-zinc-600 group-hover:text-cyan-400/80 transition-colors">导入 →</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        // 3. 高颜值空状态样式
                        <div className="flex flex-col items-center justify-center py-24 animate-in fade-in zoom-in duration-500">
                            {/* 发光霓虹光圈背景 */}
                            <div className="relative w-28 h-28 bg-[#111115] border border-white/10 rounded-full flex items-center justify-center shadow-[0_15px_30px_rgba(0,0,0,0.6)]">
                                <div className="absolute inset-0 rounded-full bg-cyan-500/10 blur-xl opacity-60 animate-pulse pointer-events-none duration-1000"></div>
                                <div className="w-16 h-16 bg-[#16161c] border border-white/5 rounded-full flex items-center justify-center text-zinc-500">
                                    <Inbox className="w-8 h-8 opacity-40 text-cyan-400/70" />
                                </div>
                            </div>
                            
                            <h3 className="text-base font-bold text-white tracking-wider mt-6 mb-1">
                                暂无历史记录
                            </h3>
                            <p className="text-xs text-zinc-500 max-w-xs text-center leading-relaxed font-semibold">
                                您在工作站中生成的 AIGC {activeTab === 'image' ? '图片' : activeTab === 'video' ? '视频' : '音乐'}会自动妥善保存到这里
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
