import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Home as HomeIcon, Folder, User, Info, Plus, Bell, ChevronDown, 
  Box, Image as ImageIcon, Video, Hash, Search, Filter, MoreHorizontal, Trash2, CheckSquare, X, Edit2, Settings
} from 'lucide-react';
import { Project } from '../types';
import { getProject, getProjects, deleteProject, saveProject } from '../services/storage';
import { deleteTopicMemory } from '../services/topic-memory';
import { getMemoryKey } from '../services/topicMemory/key';
import { AnimatePresence } from 'framer-motion';
import { SettingsModal } from '../components/SettingsModal';
import Sidebar from '../components/Sidebar';
import { createNewWorkspacePath, workspacePath } from '../utils/routes';

const toMemoryKey = (workspaceId: string, conversationId: string): string => {
  if (!workspaceId || !conversationId) return conversationId;
  if (conversationId.includes(':')) return conversationId;
  return getMemoryKey(workspaceId, conversationId);
};



const Header = () => (
  <header className="fixed top-0 left-0 right-0 h-16 px-8 flex items-center justify-between z-40 bg-white/70 backdrop-blur-md border-b border-white/20 shadow-sm shadow-gray-100/20">
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center text-white font-bold text-xs">XC</div>
      <span className="font-bold text-xl tracking-tight">XcAISTUDIO</span>
    </div>
    <div className="flex items-center gap-6">
      <div className="text-sm font-medium text-gray-600 flex items-center gap-1 cursor-pointer">
        简体中文 <ChevronDown size={14} />
      </div>
      <button className="p-2 rounded-full hover:bg-gray-200 transition">
        <Bell size={20} className="text-gray-600" />
      </button>
      <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-200 cursor-pointer">
         <img src="https://cdn.jsdelivr.net/gh/xiaoche0907/pic-bed@main/img_1769761984824_282_11dff4f8-a0df-43a9-b0db-09a846b50d34.jpg" alt="User" />
      </div>
    </div>
  </header>
);

interface ProjectCardProps {
  project?: Project;
  isNew?: boolean;
  isSelectMode: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onRename: (id: string, newName: string) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ 
    project, 
    isNew = false, 
    isSelectMode, 
    isSelected, 
    onSelect, 
    onDelete, 
    onRename 
}) => {
    const navigate = useNavigate();
    const [isRenaming, setIsRenaming] = useState(false);
    const [editName, setEditName] = useState(project?.title || '');
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isRenaming && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isRenaming]);

    const handleSaveRename = () => {
        if (project && editName.trim()) {
            onRename(project.id, editName.trim());
        }
        setIsRenaming(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSaveRename();
        if (e.key === 'Escape') {
            setEditName(project?.title || '');
            setIsRenaming(false);
        }
    };
    
    // Unified Card Structure for both New and Existing Projects
    return (
      <motion.div 
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
        onClick={() => {
            if (isNew) {
                navigate(createNewWorkspacePath());
                return;
            }
            if (isSelectMode && project) {
                onSelect(project.id);
            } else if (!isRenaming) {
                if (project?.id) navigate(workspacePath(project.id));
            }
        }}
        className={`flex flex-col gap-2 cursor-pointer group relative ${isSelected ? 'scale-95' : ''}`}
      >
        <div className={`aspect-[4/3] rounded-xl overflow-hidden border transition-all duration-300 relative group-hover:-translate-y-1 shadow-sm 
            ${isNew 
                ? 'bg-gray-50 border-dashed border-gray-300 hover:border-black/20 hover:bg-gray-100 flex items-center justify-center' 
                : isSelected 
                    ? 'bg-white border-blue-500 ring-2 ring-blue-500/20 shadow-md' 
                    : 'bg-white border-gray-200/50 group-hover:shadow-lg'
            }`}
        >
          {isNew ? (
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 transition">
                 <Plus size={24} className="text-gray-900" />
              </div>
          ) : project?.thumbnail ? (
              <img src={project.thumbnail} alt={project.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-200 bg-gray-50/50">
                  <Box size={32} className="opacity-20" />
              </div>
          )}
          
          {/* Checkbox Overlay */}
          {!isNew && (isSelectMode || isSelected) && (
              <div className="absolute top-3 left-3 w-6 h-6 rounded-full bg-white border border-gray-300 flex items-center justify-center z-20 shadow-sm transition-colors">
                  {isSelected && <div className="w-4 h-4 bg-blue-500 rounded-full" />}
              </div>
          )}

          {/* Menu Button - Only show if NOT in select mode & NOT isNew */}
          {!isNew && !isSelectMode && (
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20" onClick={(e) => e.stopPropagation()}>
                  <div className="relative" ref={menuRef}>
                      <button 
                          onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                          className="p-1.5 bg-white/90 backdrop-blur-sm rounded-lg hover:bg-white shadow-sm border border-black/5 hover:scale-105 transition"
                      >
                          <MoreHorizontal size={16} className="text-gray-600" />
                      </button>
                      
                      <AnimatePresence>
                        {showMenu && (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95, y: 5 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 5 }}
                                className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-30"
                            >
                                <button onClick={(e) => { e.stopPropagation(); setIsRenaming(true); setShowMenu(false); }} className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                    <Edit2 size={12} /> 重命名
                                </button>
                                <button onClick={(e) => { onDelete(project!.id, e); setShowMenu(false); }} className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2">
                                    <Trash2 size={12} /> 删除
                                </button>
                            </motion.div>
                        )}
                      </AnimatePresence>
                  </div>
              </div>
          )}
        </div>
        
        {/* Text Container - Same height structure for both */}
        <div>
          {isNew ? (
             <>
                <h3 className="text-sm font-medium text-gray-900">新建项目</h3>
                <p className="text-xs text-transparent select-none">Placeholder</p> 
             </>
          ) : isRenaming ? (
               <input 
                 ref={inputRef}
                 value={editName}
                 onChange={(e) => setEditName(e.target.value)}
                 onBlur={handleSaveRename}
                 onKeyDown={handleKeyDown}
                 onClick={(e) => e.stopPropagation()}
                 className="w-full text-sm font-medium text-gray-900 border-b border-blue-500 focus:outline-none bg-transparent px-0 py-0.5"
               />
          ) : (
               <>
                 <h3 className="text-sm font-medium text-gray-900 truncate group-hover:text-black transition">{project?.title || '未命名'}</h3>
                 <p className="text-xs text-gray-400">更新于 {project?.updatedAt}</p>
               </>
          )}
        </div>
      </motion.div>
    );
};

const Projects: React.FC<{ onExit?: () => void }> = ({ onExit }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const loadProjects = async () => {
      const loadedProjects = await getProjects();
      setProjects(loadedProjects);
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleSelect = (id: string) => {
      const newSelected = new Set(selectedIds);
      if (newSelected.has(id)) {
          newSelected.delete(id);
      } else {
          newSelected.add(id);
      }
      setSelectedIds(newSelected);
      if (newSelected.size === 0 && isSelectMode) {
          // Optional: Auto exit select mode if empty? User might prefer staying in select mode.
      }
  };

  const handleSelectAll = () => {
      if (selectedIds.size === projects.length) {
          setSelectedIds(new Set());
      } else {
          setSelectedIds(new Set(projects.map(p => p.id)));
      }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (confirm('确定要删除这个项目吗？此操作无法撤销。')) {
          const project = await getProject(id);
          const conversations = project?.conversations || [];
          for (const conversation of conversations) {
              await deleteTopicMemory(toMemoryKey(id, conversation.id));
          }
          await deleteTopicMemory(id);
          await deleteProject(id);
          await loadProjects();
      }
  };

  const handleBatchDelete = async () => {
      if (selectedIds.size === 0) return;
      if (confirm(`确定要删除选中的 ${selectedIds.size} 个项目吗？`)) {
          for (const id of selectedIds) {
              const project = await getProject(id);
              const conversations = project?.conversations || [];
              for (const conversation of conversations) {
                  await deleteTopicMemory(toMemoryKey(id, conversation.id));
              }
              await deleteTopicMemory(id);
              await deleteProject(id);
          }
          await loadProjects();
          setSelectedIds(new Set());
          setIsSelectMode(false);
      }
  };

  const handleRename = async (id: string, newName: string) => {
      const project = projects.find(p => p.id === id);
      if (project) {
          await saveProject({ ...project, title: newName });
          await loadProjects();
      }
  };

  const filteredProjects = projects.filter(p => 
      p.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (!p.title && searchQuery.toLowerCase() === '未命名')
  );

  return (
    <div className="min-h-screen pb-20 bg-gray-50/50">
      <Header />
      <Sidebar />
      {onExit && (
        <button
          onClick={onExit}
          className="fixed top-24 left-6 z-[60] px-4 py-2 bg-white backdrop-blur-md border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-all font-medium text-sm flex items-center gap-2 shadow-sm"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          返回主页
        </button>
      )}
      
      <main className="pt-20 lg:pt-24 px-4 sm:px-[6%] max-w-[1600px] mx-auto transition-all duration-300 pb-32 lg:pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div className="flex items-center gap-4">
                <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">项目</h1>
                <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full font-medium">{projects.length}</span>
            </div>
            
            <div className="flex items-center gap-3">
                {isSelectMode ? (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
                        <span className="text-sm text-gray-500 font-medium mr-2">已选 {selectedIds.size} 项</span>
                        <button 
                            onClick={handleSelectAll} 
                            className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition shadow-sm"
                        >
                            {selectedIds.size === projects.length ? '取消全选' : '全选'}
                        </button>
                        <button 
                            onClick={handleBatchDelete} 
                            disabled={selectedIds.size === 0}
                            className="px-3 py-1.5 bg-red-50 border border-red-100 rounded-lg text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm flex items-center gap-1"
                        >
                            <Trash2 size={12} /> 批量删除
                        </button>
                        <button 
                            onClick={() => { setIsSelectMode(false); setSelectedIds(new Set()); }}
                            className="p-1.5 text-gray-400 hover:text-black transition"
                        >
                            <X size={18} />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                         <button 
                            onClick={() => setIsSelectMode(true)}
                            className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-black hover:bg-black/5 rounded-lg transition"
                        >
                            管理
                        </button>
                    </div>
                )}
                
                <div className="h-6 w-px bg-gray-200 hidden md:block"></div>

                <div className="relative group">
                    <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="搜索项目..." 
                        className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 w-full md:w-64 transition-all shadow-sm group-hover:border-gray-300"
                    />
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-gray-600 transition" />
                </div>
            </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
            <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               transition={{ duration: 0.2 }}
            >
                <ProjectCard 
                    isNew 
                    isSelectMode={isSelectMode} 
                    isSelected={false} 
                    onSelect={() => {}} 
                    onDelete={() => {}} 
                    onRename={() => {}}
                />
            </motion.div>
            
            <AnimatePresence mode='popLayout'>
                {filteredProjects.map(p => (
                  <ProjectCard 
                    key={p.id} 
                    project={p} 
                    isSelectMode={isSelectMode}
                    isSelected={selectedIds.has(p.id)}
                    onSelect={handleSelect}
                    onDelete={handleDelete}
                    onRename={handleRename}
                  />
                ))}
            </AnimatePresence>
            
            {filteredProjects.length === 0 && projects.length > 0 && (
                 <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-400">
                    <p>没有找到匹配的项目</p>
                 </div>
            )}
            
            {projects.length === 0 && (
                <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-400 gap-4">
                    <div className="w-16 h-16 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center">
                        <Folder size={32} className="opacity-20" />
                    </div>
                    <p className="text-sm">暂无项目，点击上方 "新建项目" 开始创作</p>
                </div>
            )}
        </div>
      </main>
    </div>
  );
};

export default Projects;
