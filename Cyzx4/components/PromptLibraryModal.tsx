import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Check, Copy, Pencil, Plus, Save, Search, Sparkles, Trash2, X } from 'lucide-react';

export interface SavedPrompt {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

interface PromptLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (prompt: string) => void;
  currentPrompt?: string;
}

const STORAGE_KEY = 'xcai_prompt_library_v1';

const loadPrompts = (): SavedPrompt[] => {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is SavedPrompt => (
      typeof item?.id === 'string' &&
      typeof item?.title === 'string' &&
      typeof item?.content === 'string'
    ));
  } catch {
    return [];
  }
};

const createPromptId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

export const PromptLibraryModal: React.FC<PromptLibraryModalProps> = ({
  isOpen,
  onClose,
  onApply,
  currentPrompt = '',
}) => {
  const [prompts, setPrompts] = useState<SavedPrompt[]>(loadPrompts);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const filteredPrompts = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const sorted = [...prompts].sort((a, b) => b.updatedAt - a.updatedAt);
    if (!keyword) return sorted;
    return sorted.filter(item => (
      item.title.toLowerCase().includes(keyword) || item.content.toLowerCase().includes(keyword)
    ));
  }, [prompts, query]);

  const persist = (nextPrompts: SavedPrompt[]) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPrompts));
      setPrompts(nextPrompts);
      setStorageError(null);
      return true;
    } catch {
      setStorageError('词库保存失败，浏览器本地存储可能已满或被禁用。');
      return false;
    }
  };

  const resetEditor = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setShowEditor(false);
  };

  const openNewEditor = (initialContent = '') => {
    setEditingId(null);
    setTitle('');
    setContent(initialContent);
    setShowEditor(true);
  };

  const openEdit = (prompt: SavedPrompt) => {
    setEditingId(prompt.id);
    setTitle(prompt.title);
    setContent(prompt.content);
    setShowEditor(true);
  };

  const savePrompt = () => {
    const nextTitle = title.trim();
    const nextContent = content.trim();
    if (!nextTitle || !nextContent) {
      setStorageError('请填写提示词标题和正文。');
      return;
    }
    const now = Date.now();
    const nextPrompts = editingId
      ? prompts.map(item => item.id === editingId
        ? { ...item, title: nextTitle, content: nextContent, updatedAt: now }
        : item)
      : [{ id: createPromptId(), title: nextTitle, content: nextContent, createdAt: now, updatedAt: now }, ...prompts];
    if (persist(nextPrompts)) resetEditor();
  };

  const deletePrompt = (prompt: SavedPrompt) => {
    if (!window.confirm(`确定删除提示词“${prompt.title}”吗？`)) return;
    persist(prompts.filter(item => item.id !== prompt.id));
    if (editingId === prompt.id) resetEditor();
  };

  const copyPrompt = async (prompt: SavedPrompt) => {
    try {
      await navigator.clipboard.writeText(prompt.content);
      setCopiedId(prompt.id);
      window.setTimeout(() => setCopiedId(current => current === prompt.id ? null : current), 1600);
    } catch {
      setStorageError('复制失败，请手动选择提示词正文复制。');
    }
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 18 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 18 }}
          onClick={event => event.stopPropagation()}
          className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl dark:bg-[#1a1a1a]"
          role="dialog"
          aria-modal="true"
          aria-label="我的提示词库"
        >
          <header className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-violet-50/80 to-transparent px-6 py-5 dark:border-white/5 dark:from-violet-500/10 sm:px-8">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-500/20">
                <BookOpen className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">我的提示词库</h2>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">保存常用 Prompt，并一键应用到创意描述</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10" aria-label="关闭词库">
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="flex flex-wrap gap-2 border-b border-gray-100 bg-gray-50/40 px-6 py-4 dark:border-white/5 dark:bg-black/10 sm:px-8">
            <label className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="搜索提示词标题或正文"
                className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </label>
            {currentPrompt.trim() && (
              <button type="button" onClick={() => openNewEditor(currentPrompt)} className="flex h-11 items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 text-sm font-bold text-violet-700 transition hover:bg-violet-100">
                <Save className="h-4 w-4" /> 保存当前创意
              </button>
            )}
            <button type="button" onClick={() => openNewEditor()} className="flex h-11 items-center gap-2 rounded-xl bg-[#172238] px-4 text-sm font-bold text-white transition hover:bg-[#22304c]">
              <Plus className="h-4 w-4" /> 新建提示词
            </button>
          </div>

          {storageError && (
            <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 sm:mx-8">{storageError}</div>
          )}

          {showEditor && (
            <section className="mx-6 mt-4 rounded-2xl border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-500/20 dark:bg-violet-500/5 sm:mx-8">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-black text-gray-900 dark:text-white">
                  <Sparkles className="h-4 w-4 text-violet-600" /> {editingId ? '编辑提示词' : '新建提示词'}
                </h3>
                <button type="button" onClick={resetEditor} className="rounded-lg p-1.5 text-gray-400 hover:bg-white hover:text-gray-700"><X className="h-4 w-4" /></button>
              </div>
              <input
                autoFocus
                value={title}
                onChange={event => setTitle(event.target.value)}
                placeholder="提示词标题，例如：高清放大"
                maxLength={80}
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-white/10 dark:bg-black/20 dark:text-white"
              />
              <textarea
                value={content}
                onChange={event => setContent(event.target.value)}
                placeholder="输入完整 Prompt 内容…"
                className="mt-3 min-h-32 w-full resize-y rounded-xl border border-gray-200 bg-white p-4 text-sm leading-6 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-white/10 dark:bg-black/20 dark:text-white"
              />
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={resetEditor} className="rounded-xl px-4 py-2 text-sm font-bold text-gray-500 hover:bg-white">取消</button>
                <button type="button" onClick={savePrompt} className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700"><Save className="h-4 w-4" />保存</button>
              </div>
            </section>
          )}

          <main className="min-h-0 flex-1 overflow-y-auto p-6 custom-scrollbar sm:p-8">
            {filteredPrompts.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 text-center dark:border-white/10">
                <BookOpen className="h-10 w-10 text-gray-300" />
                <p className="mt-4 text-sm font-black text-gray-600 dark:text-gray-300">{query ? '没有匹配的提示词' : '词库还是空的'}</p>
                <p className="mt-1 text-xs text-gray-400">保存常用 Prompt 后，可在这里快速复用</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {filteredPrompts.map(prompt => (
                  <article key={prompt.id} className="group flex min-h-44 flex-col rounded-2xl border border-gray-200 bg-gray-50/70 p-5 transition hover:border-violet-300 hover:bg-white hover:shadow-md dark:border-white/10 dark:bg-white/5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-black text-gray-900 dark:text-white">{prompt.title}</h3>
                      <span className="shrink-0 text-[10px] text-gray-400">{new Date(prompt.updatedAt).toLocaleDateString('zh-CN')}</span>
                    </div>
                    <p className="mt-3 line-clamp-4 flex-1 whitespace-pre-wrap text-sm leading-6 text-gray-600 dark:text-gray-300">{prompt.content}</p>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200/70 pt-3 dark:border-white/10">
                      <button type="button" onClick={() => { onApply(prompt.content); onClose(); }} className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-violet-700">
                        <Sparkles className="h-3.5 w-3.5" /> 应用到创意描述
                      </button>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => void copyPrompt(prompt)} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-violet-50 hover:text-violet-700" title="复制提示词" aria-label="复制提示词">
                          {copiedId === prompt.id ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                        </button>
                        <button type="button" onClick={() => openEdit(prompt)} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-violet-50 hover:text-violet-700" title="编辑提示词" aria-label="编辑提示词"><Pencil className="h-4 w-4" /></button>
                        <button type="button" onClick={() => deletePrompt(prompt)} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-red-50 hover:text-red-600" title="删除提示词" aria-label="删除提示词"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </main>

          <footer className="flex items-center justify-between border-t border-gray-100 bg-gray-50/60 px-6 py-4 text-xs text-gray-400 dark:border-white/5 dark:bg-black/20 sm:px-8">
            <span>共 {prompts.length} 条提示词 · 保存在当前浏览器</span>
            <button type="button" onClick={onClose} className="rounded-xl bg-gray-900 px-5 py-2 text-sm font-bold text-white transition hover:scale-[1.02] dark:bg-white dark:text-black">关闭</button>
          </footer>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
};
