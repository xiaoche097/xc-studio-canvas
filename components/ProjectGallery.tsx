import React, { useEffect, useState } from 'react';
import { storageService, Project } from '../services/storageService';
import { ProjectCard } from './ProjectCard';
import { Loader2, Filter, Inbox, Search } from 'lucide-react';
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

    const filters = [
        { id: 'ALL', label: '全部项目' },
        { id: 'LAUNCH_PACKAGE', label: 'SKYSPER视觉系统' },
        { id: 'SEAT_COVER', label: '座套试装' },
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
            // Refresh local state
            const newProjects = projects.filter(p => p.id !== id);
            setProjects(newProjects);
            filterProjects(newProjects, currentFilter, searchQuery);
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

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="搜索项目..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-4 py-1.5 text-sm bg-gray-100 dark:bg-black/20 border border-transparent focus:bg-white dark:focus:bg-black focus:border-brand-orange outline-none rounded-full w-full md:w-48 transition-all"
                    />
                </div>
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
