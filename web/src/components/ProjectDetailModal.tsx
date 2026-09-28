import React, { useState } from 'react';
import { Project } from '../services/storageService';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Tag, FileText, Download, Trash2, Copy, Check } from 'lucide-react';
import { downloadImageFile } from '../modules/Cyzx4/utils/imageDownload';

interface ProjectDetailModalProps {
    project: Project | null;
    onClose: () => void;
    onDelete: (id: string) => void;
}

export const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({ project, onClose, onDelete }) => {
    const [copiedPrompt, setCopiedPrompt] = useState(false);

    if (!project) return null;

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleString();
    };

    const handleDownload = async (url: string, index: number) => {
        try {
            await downloadImageFile(url, `skysper_project_${project.type}_${project.createdAt}_${index}.png`);
        } catch (error) {
            console.error('Failed to download project image.', error);
            window.alert('图片下载失败，请稍后重试');
        }
    };

    const handleCopyPrompt = async () => {
        if (!project.metadata.prompt) return;
        try {
            await navigator.clipboard.writeText(project.metadata.prompt);
            setCopiedPrompt(true);
            window.setTimeout(() => setCopiedPrompt(false), 1500);
        } catch (error) {
            console.error('Failed to copy prompt:', error);
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white dark:bg-[#151515] rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col md:flex-row"
                >
                    {/* Left: Image Viewer (Scrollable if multiple) */}
                    <div className="flex-1 bg-black/5 dark:bg-black/50 relative flex items-center justify-center min-h-[300px] overflow-y-auto custom-scrollbar">
                        <div className="p-8 w-full h-full flex flex-col gap-4 items-center">
                            {project.type === 'ANALYSIS' ? (
                                <div className="w-full h-full overflow-auto bg-white dark:bg-[#1a1a1a] p-6 rounded-lg shadow-sm border border-gray-100 dark:border-white/5">
                                    <div className="prose dark:prose-invert max-w-none">
                                        <h3 className="text-lg font-bold mb-4">分析报告数据</h3>
                                        <pre className="text-xs font-mono whitespace-pre-wrap bg-gray-50 dark:bg-black/20 p-4 rounded-lg overflow-x-auto">
                                            {(() => {
                                                try {
                                                    const content = project.assets.generated[0];
                                                    const data = JSON.parse(content);
                                                    return JSON.stringify(data, null, 2);
                                                } catch (e) {
                                                    return project.assets.generated[0] || '无数据';
                                                }
                                            })()}
                                        </pre>
                                    </div>
                                </div>
                            ) : (
                                project.assets.generated.map((img, idx) => (
                                    <div key={idx} className="relative group w-full max-w-3xl">
                                        <img src={img} alt={`Generated ${idx}`} className="w-full h-auto rounded-lg shadow-lg" />
                                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                            <button
                                                onClick={() => handleDownload(img, idx)}
                                                className="p-2 bg-white/90 text-gray-700 rounded-full hover:bg-brand-orange hover:text-white transition-colors shadow-lg"
                                                title="下载图片"
                                            >
                                                <Download className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                            {project.assets.generated.length === 0 && (
                                <div className="text-gray-400">没有生成的图片</div>
                            )}
                        </div>
                    </div>

                    {/* Right: Info Panel */}
                    <div className="w-full md:w-96 bg-white dark:bg-[#1a1a1a] border-l border-gray-100 dark:border-white/5 flex flex-col h-full max-h-[50vh] md:max-h-full">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-start">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">项目详情</h2>
                                <span className="text-xs text-brand-orange bg-brand-orange/10 px-2 py-0.5 rounded-full font-medium">
                                    {project.type}
                                </span>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Date */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <Calendar className="w-3 h-3" /> 创建时间
                                </label>
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {formatDate(project.createdAt)}
                                </p>
                            </div>

                            {/* Input Assets */}
                            {project.assets.original && project.assets.original.length > 0 && (
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <Tag className="w-3 h-3" /> 输入素材
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {project.assets.original.map((img, i) => (
                                            <div key={i} className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-white/10">
                                                <img src={img} alt="Input" className="w-full h-full object-cover" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Prompt/Params */}
                            {project.metadata.prompt && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                            <FileText className="w-3 h-3" /> 提示词 / 描述
                                        </label>
                                        <button
                                            onClick={handleCopyPrompt}
                                            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-gray-500 hover:text-brand-orange hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                                            title="复制提示词"
                                        >
                                            {copiedPrompt ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                            {copiedPrompt ? '已复制' : '复制'}
                                        </button>
                                    </div>
                                    <div className="max-h-40 md:max-h-56 overflow-y-auto custom-scrollbar p-3 bg-gray-50 dark:bg-black/20 rounded-lg text-xs text-gray-600 dark:text-gray-400 leading-relaxed font-mono break-words whitespace-pre-wrap">
                                        {project.metadata.prompt}
                                    </div>
                                </div>
                            )}

                            {project.metadata.params && Object.keys(project.metadata.params).length > 0 && (
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <SettingsIcon className="w-3 h-3" /> 参数配置
                                    </label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {Object.entries(project.metadata.params).map(([key, value]) => (
                                            <div key={key} className="flex justify-between text-xs py-1 border-b border-gray-100 dark:border-white/5 last:border-0">
                                                <span className="text-gray-400">{key}:</span>
                                                <span className="font-medium text-gray-700 dark:text-gray-300 truncate max-w-[150px]" title={String(value)}>{String(value)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Action */}
                        <div className="p-6 border-t border-gray-100 dark:border-white/5">
                            <button
                                onClick={() => {
                                    if (confirm('确定要删除此项目吗？')) {
                                        onDelete(project.id);
                                        onClose();
                                    }
                                }}
                                className="w-full py-3 rounded-xl border border-red-200 dark:border-red-900/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                            >
                                <Trash2 className="w-4 h-4" /> 删除项目
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

// Helper icon
const SettingsIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.39a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
        <circle cx="12" cy="12" r="3"></circle>
    </svg>
);
