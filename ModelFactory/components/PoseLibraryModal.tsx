import React, { useState, useEffect } from 'react';
import { X, Trash2, Clock, CheckCircle2, LayoutGrid, Zap, FolderHeart } from 'lucide-react';

export interface SavedPoseSet {
  id: string;
  name: string;
  aspectRatio: string;
  coverImage: string;
  poses: string[];
  createdAt: number;
}

const STORAGE_KEY = 'skysper_saved_pose_sets';

export const savePoseSet = (set: SavedPoseSet) => {
  const existing = getSavedPoseSets();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([set, ...existing]));
};

export const getSavedPoseSets = (): SavedPoseSet[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const deletePoseSet = (id: string) => {
  const existing = getSavedPoseSets();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.filter(s => s.id !== id)));
};

interface PoseLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadPreset: (preset: SavedPoseSet) => void;
}

const PoseLibraryModal: React.FC<PoseLibraryModalProps> = ({ isOpen, onClose, onLoadPreset }) => {
  const [savedSets, setSavedSets] = useState<SavedPoseSet[]>([]);
  const [expandedSetId, setExpandedSetId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSavedSets(getSavedPoseSets());
      setExpandedSetId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("确定要删除这套动作预设吗？")) {
      deletePoseSet(id);
      setSavedSets(getSavedPoseSets());
      if (expandedSetId === id) setExpandedSetId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex justify-end bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
      <div 
        className="w-[480px] h-full bg-white shadow-[-20px_0_60px_rgba(0,0,0,0.1)] overflow-y-auto animate-in slide-in-from-right duration-500 ease-out border-l border-slate-100" 
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-slate-100 z-10 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-pink-100 text-pink-500 rounded-xl">
              <FolderHeart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">我的动作库</h2>
              <p className="text-[11px] text-slate-500 uppercase tracking-widest font-medium">Pose Library</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6">
          {savedSets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <LayoutGrid className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-500 font-medium mb-1">您的动作库空空如也</p>
              <p className="text-xs text-slate-400">在生成满意的动作网格时点击“保存预设”即可存入此处</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {savedSets.map(set => (
                <div key={set.id} className="border border-slate-100 rounded-2xl overflow-hidden hover:border-pink-200 hover:shadow-lg hover:shadow-pink-500/5 transition-all group">
                  <div 
                    className="flex items-center gap-4 p-4 cursor-pointer bg-white" 
                    onClick={() => setExpandedSetId(expandedSetId === set.id ? null : set.id)}
                  >
                    <div className="w-16 h-16 rounded-lg bg-black/5 overflow-hidden shrink-0 ring-1 ring-black/5">
                      {set.coverImage ? (
                        <img src={set.coverImage} className="w-full h-full object-cover" alt="Cover" />
                      ) : (
                        <LayoutGrid className="w-full h-full p-4 text-slate-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-800 truncate mb-1">{set.name}</h3>
                      <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                        <span className="flex items-center gap-1"><LayoutGrid className="w-3 h-3" /> {set.aspectRatio}</span>
                        <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {set.poses.length} 个姿势</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(set.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => handleDelete(e, set.id)}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {expandedSetId === set.id && (
                    <div className="bg-slate-50/50 p-4 border-t border-slate-100 flex flex-col gap-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                          原图恢复 (载入至当前工作台以供继续编辑或裁切)
                        </div>
                      </div>
                      
                      <div className="relative w-full rounded-xl overflow-hidden shadow-sm border border-slate-200 bg-white group/image">
                        <img 
                          src={set.coverImage} 
                          alt="Pose Grid" 
                          className="w-full h-auto block object-contain transition-transform duration-500 group-hover/image:scale-[1.02]" 
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/image:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                           <button 
                             onClick={() => onLoadPreset({...set})}
                             className="px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold rounded-xl shadow-2xl transform translate-y-4 group-hover/image:translate-y-0 transition-all active:scale-95 flex items-center gap-2 hover:shadow-orange-500/50"
                           >
                              <LayoutGrid className="w-5 h-5"/> 恢复该网格至工作台
                           </button>
                        </div>
                      </div>

                      <details className="text-xs text-slate-500 mt-2">
                        <summary className="cursor-pointer hover:text-slate-700 font-medium outline-none transition-colors">
                          <span className="ml-1">查看原始分镜文本 ({set.poses.length})</span>
                        </summary>
                        <div className="mt-3 flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar p-3 bg-white rounded-xl border border-slate-100 shadow-inner">
                          {set.poses.map((pose, idx) => {
                            const poseTitleMatch = pose.match(/^\d+\.\s*(.+?):/);
                            const title = poseTitleMatch ? poseTitleMatch[1] : `姿势 ${idx + 1}`;
                            return (
                              <div key={idx} className="bg-slate-50 p-2.5 rounded-lg text-slate-600 flex flex-col gap-1 border border-slate-100 hover:border-slate-200 transition-colors">
                                <span className="font-bold text-slate-700 text-[11px]">{title}</span>
                                <span className="text-[10px] leading-relaxed break-words opacity-80">{pose.replace(/^\d+\.\s*(.+?):/, '').trim()}</span>
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PoseLibraryModal;
