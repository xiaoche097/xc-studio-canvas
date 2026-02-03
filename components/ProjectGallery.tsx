import React, { useEffect, useState } from 'react';
import { storageService, Project } from '../services/storageService';
import { ProjectCard } from './ProjectCard';
import { Loader2, Filter, Inbox, Search, CheckSquare, Trash2, X, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProjectGalleryProps {
    onSelectProject: (project: Project) => void;
    className?: string; // Allow customization
}

export const ProjectGallery: React.FC<ProjectGalleryProps> = ({ onSelectProject, className = "" }) => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentFilter, setCurrentFilter] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    // Selection Mode State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const filters = [
        { id: 'ALL', label: '全部项目' },
        { id: 'LAUNCH_PACKAGE', label: 'SKYSPER视觉系统' },
        { id: 'SEAT_COVER', label: '座套试装' },
        { id: 'FUSION', label: '图像生成' }, // New FUSION Tab
        { id: 'RETOUCHING', label: '智能修图' },
        { id: 'MARKETING', label: '营销图' },
        { id: 'MODEL', label: '模特上身' },
        { id: 'VIDEO', label: '视频' },
        { id: 'ANALYSIS', label: '分析专家' },
    ];

    const loadProjects = async () => {
        setLoading(true);
        try {
            const allProjects = await storageService.getAllProjects();
            setProjects(allProjects);
            filterProjects(allProjects, currentFilter, searchQuery);
        } catch (error) {
            console.error("Failed to load projects:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProjects();
    }, []);

    useEffect(() => {
        filterProjects(projects, currentFilter, searchQuery);
    }, [currentFilter, searchQuery, projects]);

    // Clear selection when filter changes
    useEffect(() => {
        setSelectedIds(new Set());
    }, [currentFilter, searchQuery]);

    const filterProjects = (allProjects: Project[], filterType: string, query: string) => {
        let result = allProjects;

        // Type Filter
        if (filterType !== 'ALL') {
            result = result.filter(p => p.type === filterType);
        }

        // Search Query (matches prompt or ID)
        if (query) {
            const lowerQuery = query.toLowerCase();
            result = result.filter(p =>
                (p.metadata.prompt && p.metadata.prompt.toLowerCase().includes(lowerQuery)) ||
                (p.metadata.params && JSON.stringify(p.metadata.params).toLowerCase().includes(lowerQuery))
            );
        }

        setFilteredProjects(result);
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm('确定要删除这个项目吗？此操作无法撤销。')) {
            await storageService.deleteProject(id);
            const newProjects = projects.filter(p => p.id !== id);
            setProjects(newProjects);
            filterProjects(newProjects, currentFilter, searchQuery);
        }
    };

    // Selection Handlers
    const toggleSelectionMode = () => {
        setIsSelectionMode(!isSelectionMode);
        setSelectedIds(new Set());
    };

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleSelectAll = () => {
        if (selectedIds.size === filteredProjects.length && filteredProjects.length > 0) {
            setSelectedIds(new Set()); // Deselect all
        } else {
            const newSet = new Set(filteredProjects.map(p => p.id));
            setSelectedIds(newSet);
        }
    };

    const handleBatchDelete = async () => {
        if (selectedIds.size === 0) return;
        if (confirm(`确定要删除选中的 ${selectedIds.size} 个项目吗？`)) {
            setLoading(true);
            try {
                // Parallel deletion
                await Promise.all(Array.from(selectedIds).map(id => storageService.deleteProject(id)));

                // Update Local State
                const newProjects = projects.filter(p => !selectedIds.has(p.id));
                setProjects(newProjects);
                // Filtering will happen automatically via useEffect

                setIsSelectionMode(false);
                setSelectedIds(new Set());
            } catch (e) {
                console.error("Batch delete failed", e);
                alert("批量删除失败，请重试");
            } finally {
                setLoading(false);
            }
        }
    };

    if (loading) {
        return (
            <div className={`flex flex-col items-center justify-center p-12 text-gray-400 ${className}`}>
                <Loader2 className="w-8 h-8 animate-spin mb-3" />
                <p className="text-sm">加载项目中...</p>
            </div>
        );
    }

    return (
        <div className={`flex flex-col h-full bg-gray-50/50 dark:bg-black/50 ${className}`}>
            {/* Header / Filter Bar */}
            <div className="flex flex-col md:flex-row gap-4 p-4 md:items-center justify-between bg-white dark:bg-[#151515] border-b border-gray-100 dark:border-white/5 sticky top-0 z-10 backdrop-blur-md bg-opacity-80 dark:bg-opacity-80">

                {/* Selection Toolbar (Overlay or Inline) */}
                {isSelectionMode ? (
                    <div className="flex items-center gap-3 w-full animate-fade-in bg-brand-orange/5 p-2 rounded-lg border border-brand-orange/20">
                        <button
                            onClick={toggleSelectionMode}
                            className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full text-gray-500"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <span className="text-sm font-medium text-brand-orange">已选择 {selectedIds.size} 项</span>

                        <div className="h-4 w-px bg-gray-300 mx-2"></div>

                        <button
                            onClick={handleSelectAll}
                            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-brand-orange px-3 py-1.5 rounded hover:bg-white/50"
                        >
                            {selectedIds.size === filteredProjects.length && filteredProjects.length > 0 ? (
                                <><CheckSquare className="w-4 h-4" /> 取消全选</>
                            ) : (
                                <><Square className="w-4 h-4" /> 全选本页</>
                            )}
                        </button>

                        <div className="flex-1"></div>

                        <button
                            onClick={handleBatchDelete}
                            disabled={selectedIds.size === 0}
                            className={`flex items-center gap-1.5 text-xs font-medium px-4 py-1.5 rounded-full transition-all ${selectedIds.size > 0
                                ? 'bg-red-500 text-white hover:bg-red-600 shadow-sm'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            <Trash2 className="w-4 h-4" />
                            批量删除
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Filters */}
                        <div className="flex overflow-x-auto pb-2 md:pb-0 gap-2 no-scrollbar">
                            {filters.map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => setCurrentFilter(f.id)}
                                    className={`
                                    whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-all
                                    ${currentFilter === f.id
                                            ? 'bg-brand-orange text-white shadow-sm shadow-brand-orange/30'
                                            : 'bg-gray-100 dark:bg-white/5 text-gray-500 hover:bg-gray-200 dark:hover:bg-white/10'}
                                `}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        {/* Search & Actions */}
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="搜索项目..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 pr-4 py-1.5 text-sm bg-gray-100 dark:bg-black/20 border border-transparent focus:bg-white dark:focus:bg-black focus:border-brand-orange outline-none rounded-full w-32 md:w-48 transition-all"
                                />
                            </div>
                            <button
                                onClick={toggleSelectionMode}
                                className="p-1.5 text-gray-400 hover:text-brand-orange hover:bg-gray-100 rounded-lg transition-colors"
                                title="批量管理"
                            >
                                <CheckSquare className="w-5 h-5" />
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Gallery Grid */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 no-scrollbar">
                {filteredProjects.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        <AnimatePresence>
                            {filteredProjects.map((project) => (
                                <motion.div
                                    key={project.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <ProjectCard
                                        project={project}
                                        onClick={onSelectProject}
                                        onDelete={handleDelete}
                                        selectable={isSelectionMode}
                                        selected={selectedIds.has(project.id)}
                                        onToggleSelect={toggleSelect}
                                    />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                            <Inbox className="w-8 h-8 opacity-50" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">没有找到项目</h3>
                        <p className="text-sm max-w-xs text-center">
                            {currentFilter !== 'ALL' || searchQuery
                                ? '尝试调整筛选或搜索关键词'
                                : '你生成的内容将会自动保存到这里'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
