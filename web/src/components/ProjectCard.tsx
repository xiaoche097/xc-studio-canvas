import React from 'react';
import { Project } from '../services/storageService';
import { Trash2, Calendar, Image as ImageIcon, CheckCircle2, Circle } from 'lucide-react';

interface ProjectCardProps {
    project: Project;
    onClick: (project: Project) => void;
    onDelete: (e: React.MouseEvent, id: string) => void;
    selectable?: boolean;
    selected?: boolean;
    onToggleSelect?: (id: string) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
    project,
    onClick,
    onDelete,
    selectable,
    selected,
    onToggleSelect
}) => {
    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString() + ' ' + new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'OUTFIT_DECONSTRUCTION': return '穿搭分离';
            case 'SEAT_COVER': return '座套试装';
            case 'MARKETING': return '营销图';
            case 'MODEL': return '模特上身';
            case 'VIDEO': return '视频';
            case 'ANALYSIS': return '分析专家';
            case 'LAUNCH_PACKAGE': return 'SKYSPER视觉系统';
            case 'FUSION': return '图像生成';
            default: return '其他';
        }
    };

    const getStatusColor = (type: string) => {
        switch (type) {
            case 'OUTFIT_DECONSTRUCTION': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
            case 'SEAT_COVER': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
            case 'MARKETING': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
            case 'MODEL': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
            case 'LAUNCH_PACKAGE': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
            case 'FUSION': return 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300';
            default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
        }
    };

    const handleCardClick = (e: React.MouseEvent) => {
        if (selectable && onToggleSelect) {
            e.stopPropagation();
            onToggleSelect(project.id);
        } else {
            onClick(project);
        }
    };

    return (
        <div
            className={`group relative bg-white dark:bg-[#1a1a1a] rounded-xl overflow-hidden border shadow-sm transition-all cursor-pointer ${selected
                    ? 'border-brand-orange ring-2 ring-brand-orange/20'
                    : 'border-gray-100 dark:border-white/5 hover:shadow-md hover:border-brand-orange/30'
                }`}
            onClick={handleCardClick}
        >
            {/* Thumbnail */}
            <div className="aspect-square w-full overflow-hidden bg-gray-50 dark:bg-black/20 relative">
                {project.thumbnail ? (
                    <img
                        src={project.thumbnail}
                        alt="Project Thumbnail"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <ImageIcon className="w-8 h-8" />
                    </div>
                )}

                {/* Selection Overlay */}
                {selectable && (
                    <div className={`absolute inset-0 bg-black/10 flex items-start justify-end p-2 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <div className={`rounded-full p-0.5 ${selected ? 'bg-brand-orange text-white' : 'bg-white/80 text-gray-400'}`}>
                            {selected ? <CheckCircle2 className="w-5 h-5 fill-current" /> : <Circle className="w-5 h-5" />}
                        </div>
                    </div>
                )}

                {/* Actions (Only show if NOT in selection mode) */}
                {!selectable && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => onDelete(e, project.id)}
                            className="p-2 bg-white/90 dark:bg-black/80 text-red-500 rounded-full hover:bg-red-50 dark:hover:bg-red-900/50 transition-colors shadow-sm"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getStatusColor(project.type)}`}>
                        {getTypeLabel(project.type)}
                    </span>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(project.createdAt)}
                </p>
            </div>
        </div>
    );
};
