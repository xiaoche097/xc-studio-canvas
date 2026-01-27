import React, { useState } from 'react';
import { ProjectGallery } from './ProjectGallery';
import { ProjectDetailModal } from './ProjectDetailModal';
import { Project, storageService } from '../services/storageService';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ProjectGalleryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ProjectGalleryModal: React.FC<ProjectGalleryModalProps> = ({ isOpen, onClose }) => {
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);

    const handleDeleteFromDetail = async (id: string) => {
        await storageService.deleteProject(id);
        setSelectedProject(null);
        // Note: The ProjectGallery will not automatically refresh here because its state is internal.
        // A more robust solution would lift the state or use a context, but for MVP we can force a re-render or let the user close/reopen.
        // For better experience, we could pass a refreshment trigger to ProjectGallery, but simplicity first.
        // Actually, since ProjectGallery re-fetches on mount, simply closing the detail modal updates the view *if* we trigger an update.
        // Let's rely on the Gallery auto-updating if we pass a key or ref.
        // Alternatively, we can just close the detail modal. The user will see the item deleted if they refresh or if we implement a reload callback.
        // We'll implement a simple callback approach in the next iteration if needed.
    };

    if (!isOpen) return null;

    return (
        <>
            <AnimatePresence>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white dark:bg-[#121212] w-full h-full max-w-7xl rounded-3xl overflow-hidden shadow-2xl relative flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <span className="text-brand-orange">✨</span> 项目历史
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">管理你的创意资产与历史生成记录</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Gallery Content */}
                        <div className="flex-1 overflow-hidden relative">
                            {/* We use a key to force re-render when a project is deleted from detail view, ensuring the list is up to date */}
                            <ProjectGallery
                                onSelectProject={setSelectedProject}
                                key={selectedProject ? 'has-selection' : 'no-selection'}
                            />
                        </div>
                    </motion.div>
                </motion.div>
            </AnimatePresence>

            {/* Detail Overlay */}
            <ProjectDetailModal
                project={selectedProject}
                onClose={() => setSelectedProject(null)}
                onDelete={handleDeleteFromDetail}
            />
        </>
    );
};
