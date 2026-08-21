import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  MoreHorizontal,
  Copy,
  SlidersHorizontal,
  X,
  Cloud,
  FolderInput,
  Check,
  CornerUpRight,
  Download,
} from 'lucide-react';
import ClipperModal from '../../../components/ClipperModal';

export interface ClippedItem {
  id: string;
  title: string;
  url: string;
  sourceUrl?: string;
  platform?: 'xiaohongshu' | 'instagram' | 'amazon' | 'taobao' | 'pinterest' | 'other';
  category?: string; // 'uncategorized' | custom category
  timestamp: number;
}

interface ClipperLibraryViewProps {
  onAddToConversation?: (imageUrl: string, title: string) => void;
}

export const ClipperLibraryView: React.FC<ClipperLibraryViewProps> = ({
  onAddToConversation,
}) => {
  // 不再放入硬编码示例图片，初始为空数组 (完美响应“不要有的那些图片进占位”)
  const [items, setItems] = useState<ClippedItem[]>(() => {
    try {
      const stored = localStorage.getItem('xc_ai_clipped_items');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  // 分类 Tabs：默认【只保留全部和未分类】，用户自行新建分类
  const [categories, setCategories] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('xc_ai_user_categories');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return ['all', 'uncategorized', ...parsed];
      }
    } catch {}
    return ['all', 'uncategorized'];
  });

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [activeMoveCategoryId, setActiveMoveCategoryId] = useState<string | null>(null);

  // 批量选择模式 (对应图 0 右侧 🎛️ 图标控制)
  const [isSelectMode, setIsSelectMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // 新建分类 Modal 弹窗 (对应图 0 右侧 + 图标控制)
  const [showCreateCategoryModal, setShowCreateCategoryModal] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // 点击放大查看大图 Modal 状态
  const [previewItem, setPreviewItem] = useState<ClippedItem | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('xc_ai_clipped_items', JSON.stringify(items));
    } catch {}
  }, [items]);

  // 1. 跨标签页 0ms 实时接收（BroadcastChannel 频道）
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('xc_ai_clipper_channel');
      bc.onmessage = (event) => {
        if (event.data && (event.data.type === 'XC_CLIPPER_SAVE_IMAGE' || event.data.action === 'CLIP_IMAGE')) {
          const raw = event.data.item || event.data;
          if (raw.url) {
            const newItem: ClippedItem = {
              id: raw.id || `clip-${Date.now()}`,
              title: raw.title || '全网剪藏灵感图',
              url: raw.url,
              sourceUrl: raw.sourceUrl,
              platform: raw.platform || 'other',
              category: 'uncategorized',
              timestamp: raw.timestamp || Date.now(),
            };
            setItems((prev) => [newItem, ...prev.filter((i) => i.id !== newItem.id && i.url !== newItem.url)]);
            setToastMsg(`✨ 已接收新灵感图`);
            setTimeout(() => setToastMsg(null), 2500);
          }
        }
      };
    } catch {}

    // 2. 监听来自 window.postMessage 消息
    const handleMessage = (event: MessageEvent) => {
      if (event.data && (event.data.type === 'XC_CLIPPER_SAVE_IMAGE' || event.data.type === 'CLIP_IMAGE') && event.data.url) {
        const newItem: ClippedItem = {
          id: `clip-${Date.now()}`,
          title: event.data.title || '全网剪藏灵感图',
          url: event.data.url,
          sourceUrl: event.data.sourceUrl,
          platform: event.data.platform || 'other',
          category: 'uncategorized',
          timestamp: Date.now(),
        };
        setItems((prev) => [newItem, ...prev.filter((i) => i.url !== newItem.url)]);
        setToastMsg(`✨ 已接收新灵感图`);
        setTimeout(() => setToastMsg(null), 2500);
      }
    };

    // 3. 监听 localStorage 跨页变更
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'xc_ai_clipped_items' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setItems(parsed);
        } catch {}
      }
    };

    // 4. 定时轮询读取 localStorage 以确保 100% 实时同屏同步
    const interval = setInterval(() => {
      try {
        const stored = localStorage.getItem('xc_ai_clipped_items');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setItems((prev) => {
              if (JSON.stringify(prev) !== JSON.stringify(parsed)) {
                return parsed;
              }
              return prev;
            });
          }
        }
      } catch {}
    }, 1000);

    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveMenuId(null);
      setActiveMoveCategoryId(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // 新建分类处理
  const handleCreateCategory = () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) {
      setToastMsg('分类名称已存在');
      setTimeout(() => setToastMsg(null), 2000);
      return;
    }

    const updated = [...categories, trimmed];
    setCategories(updated);

    const customOnly = updated.filter((c) => c !== 'all' && c !== 'uncategorized');
    try {
      localStorage.setItem('xc_ai_user_categories', JSON.stringify(customOnly));
    } catch {}

    setActiveCategory(trimmed);
    setNewCategoryName('');
    setShowCreateCategoryModal(false);
    setToastMsg(`已创建分类「${trimmed}」`);
    setTimeout(() => setToastMsg(null), 2000);
  };

  // 分类筛选
  const filteredItems = items.filter((item) => {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'uncategorized') return !item.category || item.category === 'uncategorized';
    return item.category === activeCategory;
  });

  const toggleSelectCard = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleDeleteSelectedBatch = () => {
    setItems((prev) => prev.filter((i) => !selectedIds.includes(i.id)));
    setSelectedIds([]);
    setIsSelectMode(false);
    setToastMsg('已删除选中图片');
    setTimeout(() => setToastMsg(null), 2000);
  };

  const handleAddSelectedToConversationBatch = () => {
    if (!onAddToConversation) return;
    const selectedItems = items.filter((i) => selectedIds.includes(i.id));
    selectedItems.forEach((item) => {
      onAddToConversation(item.url, item.title);
    });
    setSelectedIds([]);
    setIsSelectMode(false);
    setToastMsg('已批量带入对话框');
    setTimeout(() => setToastMsg(null), 2000);
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setActiveMenuId(null);
  };

  const handleCopyImage = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setToastMsg('📋 已复制图片链接');
      setTimeout(() => setToastMsg(null), 2000);
    } catch {
      setToastMsg('复制链接失败');
    }
    setActiveMenuId(null);
  };

  const handleMoveCategory = (itemId: string, newCat: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, category: newCat } : item))
    );
    setActiveMenuId(null);
    setActiveMoveCategoryId(null);
    setToastMsg(`已移至「${getCategoryLabel(newCat)}」`);
    setTimeout(() => setToastMsg(null), 2000);
  };

  const getCategoryLabel = (cat: string) => {
    if (cat === 'all') return '全部';
    if (cat === 'uncategorized') return '未分类';
    return cat;
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-white font-sans text-slate-900">
      {/* 实时接收 Toast 提示 */}
      {toastMsg && (
        <div className="absolute top-14 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-1.5 text-xs font-bold text-white shadow-xl backdrop-blur-md animate-fade-in">
          {toastMsg}
        </div>
      )}

      {/* 极简顶栏导航 (图 0 风格: 仅保留“全部”、“未分类”与用户创建分类；右上侧仅包含【+】与【🎛️】) */}
      <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center justify-between border-b border-slate-100 bg-white/95 px-6 backdrop-blur-sm">
        {/* 左侧 Tabs */}
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`relative py-3 text-xs font-medium transition-colors outline-none ${
                  isActive
                    ? 'text-slate-950 font-bold after:absolute after:bottom-0 after:inset-x-0 after:h-0.5 after:bg-slate-950'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {getCategoryLabel(cat)}
              </button>
            );
          })}
        </div>

        {/* 右侧仅有两个极其精致的图标 (精确复刻图 0 右侧: 【+】新建分类 & 【🎛️】选择模式) */}
        <div className="flex items-center gap-1">
          {/* 图标 1: 【+】直接触发新建分类弹窗 */}
          <button
            type="button"
            onClick={() => setShowCreateCategoryModal(true)}
            title="新建分类"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
          >
            <Plus size={16} />
          </button>

          {/* 图标 2: 【🎛️】切换选择/批量选择模式 */}
          <button
            type="button"
            onClick={() => {
              setIsSelectMode(!isSelectMode);
              if (isSelectMode) setSelectedIds([]);
            }}
            title="选择模式"
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
              isSelectMode
                ? 'bg-slate-950 text-white'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-950'
            }`}
          >
            <SlidersHorizontal size={15} />
          </button>
        </div>
      </header>

      {/* 极简网格区 */}
      <main className="flex-1 overflow-y-auto p-6 pb-24 no-scrollbar">
        {filteredItems.length > 0 ? (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filteredItems.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (isSelectMode) {
                      toggleSelectCard(item.id);
                    } else {
                      setPreviewItem(item);
                    }
                  }}
                  className="group relative flex flex-col overflow-hidden rounded-[1.2rem] bg-white transition-all duration-300 cursor-pointer"
                >
                  {/* 图片容器 */}
                  <div
                    className={`relative aspect-[3/4] w-full overflow-hidden rounded-[1.2rem] bg-slate-100 shadow-xs transition group-hover:shadow-md ${
                      isSelected ? 'ring-2 ring-slate-950 ring-offset-2' : ''
                    }`}
                  >
                    <img
                      src={item.url}
                      alt={item.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-103"
                      loading="lazy"
                    />

                    {/* 选择模式下的右上角勾选框 (精确复刻图 1 右上角 ✓ 黑色圆形角标) */}
                    {isSelectMode ? (
                      <div
                        className={`absolute right-2.5 top-2.5 z-20 flex h-6 w-6 items-center justify-center rounded-md text-white backdrop-blur-xs transition ${
                          isSelected ? 'bg-slate-950 shadow-md' : 'bg-black/30 hover:bg-black/50'
                        }`}
                      >
                        <Check size={14} className={isSelected ? 'opacity-100' : 'opacity-60'} />
                      </div>
                    ) : (
                      /* 普通模式下悬浮右上角 ... 操作按钮 */
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === item.id ? null : item.id);
                        }}
                        className="absolute right-2.5 top-2.5 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-700 backdrop-blur-md opacity-0 transition group-hover:opacity-100 hover:bg-white hover:text-slate-950 shadow-md"
                        aria-label="更多操作"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    )}

                    {/* 下拉菜单 (添加到聊天、移至分类、复制、删除) */}
                    {!isSelectMode && activeMenuId === item.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-2.5 top-12 z-30 w-40 overflow-hidden rounded-2xl border border-slate-100 bg-white p-1.5 shadow-2xl backdrop-blur-xl animate-fade-in"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (onAddToConversation) {
                              onAddToConversation(item.url, item.title);
                            }
                            setActiveMenuId(null);
                          }}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-50"
                        >
                          <Plus size={14} className="text-slate-500" />
                          添加到聊天
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopyImage(item.url)}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-50"
                        >
                          <Copy size={13} className="text-slate-500" />
                          复制图片
                        </button>

                        {/* 移动分类 */}
                        <button
                          type="button"
                          onClick={() => setActiveMoveCategoryId(activeMoveCategoryId === item.id ? null : item.id)}
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-50"
                        >
                          <span className="flex items-center gap-2">
                            <FolderInput size={13} className="text-slate-500" />
                            移至分类
                          </span>
                        </button>

                        {/* 移动分类子菜单 */}
                        {activeMoveCategoryId === item.id && (
                          <div className="my-1 border-t border-b border-slate-100 bg-slate-50/80 p-1">
                            {categories.filter((c) => c !== 'all').map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => handleMoveCategory(item.id, c)}
                                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-white"
                              >
                                <span>{getCategoryLabel(c)}</span>
                                {item.category === c && <Check size={12} className="text-slate-900" />}
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="my-1 h-px bg-slate-100" />

                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id)}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                        >
                          <Trash2 size={13} />
                          删除
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* 极简空白页：没有图片时展现 Oops. 提示 (精确复刻图 2 背景) */
          <div className="flex min-h-[22rem] flex-col items-center justify-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3 shadow-inner">
              <Cloud size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              Oops.
            </h3>
            <p className="mt-1 text-xs font-medium text-slate-400 max-w-sm">
              还没有采集任何灵感
            </p>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50"
            >
              <Download size={13} />
              获取扩展安装包
            </button>
          </div>
        )}
      </main>

      {/* 底部选择模式浮动工具栏 (精确复刻图 1 底部: 已选 1 项，取消/删除/发送) */}
      {isSelectMode && (
        <div className="absolute bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-6 rounded-2xl border border-slate-200/80 bg-white/95 px-6 py-3 shadow-2xl backdrop-blur-xl animate-fade-in">
          <div className="text-xs font-bold text-slate-700">
            已选 {selectedIds.length} 项
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsSelectMode(false);
                setSelectedIds([]);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              取消
            </button>

            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={handleDeleteSelectedBatch}
              title="批量删除"
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-rose-50 hover:text-rose-600 transition disabled:opacity-40"
            >
              <Trash2 size={14} />
            </button>

            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={handleAddSelectedToConversationBatch}
              title="批量带入聊天"
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 transition disabled:opacity-40"
            >
              <CornerUpRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* 新建分类 Modal (精确复刻截图 2 弹窗) */}
      {showCreateCategoryModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-sm rounded-[1.6rem] bg-white p-6 shadow-2xl transition-all">
            {/* 顶部标题与关闭 */}
            <div className="flex items-center justify-between pb-4">
              <h3 className="text-base font-bold text-slate-900">新建分类</h3>
              <button
                type="button"
                onClick={() => setShowCreateCategoryModal(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X size={15} />
              </button>
            </div>

            {/* 输入框 */}
            <div className="mb-6">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="分类名称"
                autoFocus
                className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:bg-slate-50 focus:ring-2 focus:ring-slate-900/10"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateCategory();
                }}
              />
            </div>

            {/* 按钮行: 取消 / 创建 */}
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowCreateCategoryModal(false)}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                取消
              </button>
              <button
                type="button"
                disabled={!newCategoryName.trim()}
                onClick={handleCreateCategory}
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 放大查看图片 Modal (Lightbox 高清预览) */}
      {previewItem && (
        <div
          onClick={() => setPreviewItem(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[90vh] max-w-[90vw] flex-col items-center overflow-hidden rounded-3xl bg-slate-900 border border-white/10 p-4 text-white shadow-2xl"
          >
            {/* 右上角关闭按钮 ✕ */}
            <button
              type="button"
              onClick={() => setPreviewItem(null)}
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition hover:bg-white/20"
              aria-label="关闭预览"
            >
              <X size={18} />
            </button>

            {/* 大图预览 */}
            <div className="flex max-h-[75vh] w-full items-center justify-center overflow-hidden rounded-2xl bg-black/40">
              <img
                src={previewItem.url}
                alt={previewItem.title}
                className="max-h-[75vh] max-w-full object-contain rounded-xl shadow-lg"
              />
            </div>

            {/* 底部信息与快速操作按键 */}
            <div className="mt-4 flex w-full items-center justify-between gap-4 px-2">
              <div>
                <h4 className="text-sm font-bold text-white line-clamp-1">{previewItem.title || '剪藏灵感图'}</h4>
                <p className="text-xs text-slate-400 mt-0.5">平台: {getCategoryLabel(previewItem.platform || 'other')}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (onAddToConversation) {
                      onAddToConversation(previewItem.url, previewItem.title);
                      setToastMsg('✨ 已添加到对话框');
                      setTimeout(() => setToastMsg(null), 2000);
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-slate-200 shadow-md cursor-pointer"
                >
                  <Plus size={14} />
                  添加到对话
                </button>

                <button
                  type="button"
                  onClick={() => handleCopyImage(previewItem.url)}
                  className="flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-xs font-bold text-white backdrop-blur-md transition hover:bg-white/20 cursor-pointer"
                >
                  <Copy size={14} />
                  复制
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleDeleteItem(previewItem.id);
                    setPreviewItem(null);
                  }}
                  className="flex items-center gap-1.5 rounded-full bg-rose-500/20 px-3.5 py-2 text-xs font-bold text-rose-400 transition hover:bg-rose-500/30 cursor-pointer"
                >
                  <Trash2 size={14} />
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 扩展指南 Modal */}
      <ClipperModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};

export default ClipperLibraryView;
