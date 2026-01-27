import React, { useEffect, useState } from 'react';
import { storageService, Project } from '../services/storageService';
import { ProjectCard } from './ProjectCard';
import { ArrowRight, Clock } from 'lucide-react';

interface RecentProjectsProps {
    onSelectProject: (project: Project) => void;
    onViewAll: () => void;
}

export const RecentProjects: React.FC<RecentProjectsProps> = ({ onSelectProject, onViewAll }) => {
    const [recentProjects, setRecentProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadRecent = async () => {
            try {
                const all = await storageService.getAllProjects();
                setRecentProjects(all.slice(0, 4)); // Get top 4
            } catch (e) {
                console.error("Failed to load recent projects", e);
            } finally {
                setLoading(false);
            }
        };
        loadRecent();
    }, []);

    if (loading) return null;
    if (recentProjects.length === 0) return null;

    return (
        <div className="w-full max-w-6xl animate-slide-up [animation-delay:200ms]">
            <div className="flex items-center justify-between mb-4 px-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-brand-orange" />
                    最近项目
                </h2>
                <button
                    onClick={onViewAll}
                    className="text-sm text-gray-500 hover:text-brand-orange flex items-center gap-1 transition-colors group"
                >
                    查看全部 <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {recentProjects.map(project => (
                    <ProjectCard
                        key={project.id}
                        project={project}
                        onClick={onSelectProject}
                        onDelete={async (e, id) => {
                            e.stopPropagation();
                            if (confirm("确定删除？")) {
                                await storageService.deleteProject(id);
                                setRecentProjects(prev => prev.filter(p => p.id !== id));
                            }
                        }}
                    />
                ))}
            </div>
        </div>
    );
};
