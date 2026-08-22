import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Trash2,
  MoreHorizontal,
  Copy,
  SlidersHorizontal,
  X,
  FolderInput,
  Check,
  CornerUpRight,
  Download,
} from 'lucide-react';
import ClipperModal from '../../../components/ClipperModal';
import { loadClippedItems, replaceClippedItems } from '../../../services/clipper-storage';
import { useImageHostStore } from '../../../stores/imageHost.store';
import { fetchImageBlob } from '../../../utils/imageDownload';
import { uploadImage } from '../../../utils/uploader';

export interface ClippedItem {
  id: string;
  title: string;
  url: string;
  originalUrl?: string;
  sourceUrl?: string;
  platform?: 'xiaohongshu' | 'instagram' | 'amazon' | 'taobao' | 'pinterest' | 'other';
  category?: string; // 'uncategorized' | custom category
  timestamp: number;
}

const blobToDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === 'string'
    ? resolve(reader.result)
    : reject(new Error('Image conversion returned an invalid result'));
  reader.onerror = () => reject(reader.error || new Error('Image conversion failed'));
  reader.readAsDataURL(blob);
});

const stabilizeClippedItem = async (item: ClippedItem): Promise<ClippedItem> => {
  try {
    const blob = await fetchImageBlob(item.url);
    const extension = blob.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
    const file = new File([blob], `clip-${item.timestamp}.${extension}`, { type: blob.type });
    const provider = useImageHostStore.getState().selectedProvider;
    const stableUrl = provider === 'none' ? await blobToDataUrl(blob) : await uploadImage(file);
    return {
      ...item,
      originalUrl: item.originalUrl || (/^https?:\/\//i.test(item.url) ? item.url : undefined),
      url: stableUrl,
    };
  } catch (error) {
    console.warn('[clipper] Failed to persist clipped image; keeping its original source.', error);
    return item;
  }
};

interface ClipperLibraryViewProps {
  onAddToConversation?: (imageUrl: string, title: string) => void;
}

const EXTENSION_DOWNLOAD_URL = `${import.meta.env.BASE_URL}xc-ai-clipper-extension.zip`;
const LEGACY_DEMO_ITEM_IDS = new Set(['demo-item-1', 'demo-item-2']);
const LEGACY_DEMO_IMAGE_MARKERS = [
  'photo-1515886657613-9f3515b0c78f',
  'photo-1539109136881-3be0616acf4b',
];

const removeLegacyDemoItems = (items: ClippedItem[]): ClippedItem[] => (
  items.filter((item) => (
    !LEGACY_DEMO_ITEM_IDS.has(item.id)
    && !LEGACY_DEMO_IMAGE_MARKERS.some((marker) => item.url.includes(marker))
  ))
);

export const ClipperLibraryView: React.FC<ClipperLibraryViewProps> = ({
  onAddToConversation,
}) => {
  const [items, setItems] = useState<ClippedItem[]>(() => {
    try {
      const stored = localStorage.getItem('xc_ai_clipped_items');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return removeLegacyDemoItems(parsed);
      }
    } catch {}
    return [];
  });
  const [clipperStorageReady, setClipperStorageReady] = useState(false);
  const receivedClipIdsRef = useRef(new Map<string, string>());

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
    let cancelled = false;
    loadClippedItems()
      .then((storedItems) => {
        if (cancelled) return;
        if (storedItems.length > 0) {
          setItems(removeLegacyDemoItems(storedItems as ClippedItem[]));
        }
      })
      .catch((error) => console.warn('[clipper] Failed to load IndexedDB library.', error))
      .finally(() => {
        if (!cancelled) setClipperStorageReady(true);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!clipperStorageReady) return;
    void replaceClippedItems(items).catch((error) => {
      console.warn('[clipper] Failed to save IndexedDB library.', error);
    });

    // Keep only lightweight metadata here for compatibility with older extension builds.
    // Image bytes live in IndexedDB so localStorage quota cannot make clips disappear.
    try {
      const metadata = items.map((item) => item.url.startsWith('data:image/')
        ? { ...item, url: item.originalUrl || '' }
        : item);
      localStorage.setItem('xc_ai_clipped_items', JSON.stringify(metadata));
    } catch {}
  }, [clipperStorageReady, items]);

  useEffect(() => {
    if (!activeMenuId) return;
    const handleOutsideClick = () => {
      setActiveMenuId(null);
      setActiveMoveCategoryId(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [activeMenuId]);

  // 1. 跨标签页 0ms 实时接收（BroadcastChannel 频道）
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    const ingestClippedItem = (raw: Partial<ClippedItem>) => {
      if (!raw.url) return;
      if (raw.id) {
        const previousUrl = receivedClipIdsRef.current.get(raw.id);
        if (previousUrl === raw.url) return;
        if (previousUrl?.startsWith('data:image/') && !raw.url.startsWith('data:image/')) return;
        receivedClipIdsRef.current.set(raw.id, raw.url);
      }
      const newItem: ClippedItem = {
        id: raw.id || `clip-${Date.now()}`,
        title: raw.title || '全网剪藏灵感图',
        url: raw.url,
        originalUrl: raw.originalUrl,
        sourceUrl: raw.sourceUrl,
        platform: raw.platform || 'other',
        category: raw.category || 'uncategorized',
        timestamp: raw.timestamp || Date.now(),
      };

      setItems((prev) => [
        newItem,
        ...prev.filter((item) => (
          item.id !== newItem.id
          && item.url !== newItem.url
          && (!newItem.originalUrl || item.originalUrl !== newItem.originalUrl)
        )),
      ]);

      void stabilizeClippedItem(newItem).then((stableItem) => {
        if (stableItem.url === newItem.url) return;
        setItems((prev) => prev.map((item) => item.id === newItem.id ? stableItem : item));
      });
      setToastMsg('已接收并保存新灵感图');
      setTimeout(() => setToastMsg(null), 2500);
    };

    try {
      bc = new BroadcastChannel('xc_ai_clipper_channel');
      bc.onmessage = (event) => {
        if (event.data && (event.data.type === 'XC_CLIPPER_SAVE_IMAGE' || event.data.action === 'CLIP_IMAGE')) {
          ingestClippedItem(event.data.item || event.data);
        }
      };
    } catch {}

    // 2. 监听来自 window.postMessage 消息
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window || !event.data) return;
      if (event.data.type === 'XC_CLIPPER_SAVE_IMAGE' || event.data.type === 'CLIP_IMAGE') {
        ingestClippedItem(event.data.item || event.data);
      }
    };

    // 3. 监听 localStorage 跨页变更
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'xc_ai_clipped_items' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as ClippedItem[];
          if (Array.isArray(parsed)) {
            parsed.filter((item) => item?.url).forEach(ingestClippedItem);
          }
        } catch {}
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorageChange);
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
      setToastMsg('已复制图片链接');
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
        <div className="absolute top-14 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-950 px-4 py-2 text-xs font-medium text-white shadow-[0_8px_24px_rgba(0,0,0,0.14)] animate-fade-in">
          {toastMsg}
        </div>
      )}

      {/* 极简顶栏导航 (图 0 风格: 仅保留“全部”、“未分类”与用户创建分类；右上侧仅包含【+】与【🎛️】) */}
      <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
        {/* 左侧 Tabs */}
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`relative min-h-12 py-3 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-slate-950 ${
                  isActive
                    ? 'text-slate-950 after:absolute after:bottom-0 after:inset-x-0 after:h-px after:bg-slate-950'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {getCategoryLabel(cat)}
              </button>
            );
          })}
        </div>

        {/* 右侧提供扩展下载、分类和批量选择入口 */}
        <div className="flex items-center gap-1">
          <a
            href={EXTENSION_DOWNLOAD_URL}
            download="xc-ai-clipper-extension.zip"
            title="下载 XC AI Clipper"
            className="mr-1 inline-flex min-h-9 items-center gap-2 rounded-lg bg-slate-950 px-3 text-xs font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
          >
            <Download size={14} />
            <span className="hidden sm:inline">下载扩展</span>
          </a>

          {/* 图标 1: 【+】直接触发新建分类弹窗 */}
          <button
            type="button"
            onClick={() => setShowCreateCategoryModal(true)}
            title="新建分类"
            className="flex h-12 w-12 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
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
            className={`flex h-12 w-12 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 ${
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
      <main className="flex-1 overflow-y-auto p-5 pb-24 no-scrollbar sm:p-6">
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
                  className={`group relative min-w-0 rounded-xl bg-white transition-all duration-300 cursor-pointer ${
                    !isSelectMode && activeMenuId === item.id
                      ? 'col-span-2 grid grid-cols-2 items-start gap-6'
                      : 'flex flex-col'
                  }`}
                >
                  {/* 图片容器 */}
                  <div
                    className={`relative aspect-[3/4] w-full min-w-0 overflow-hidden rounded-[10px] bg-slate-100 transition ${
                      isSelected ? 'ring-2 ring-slate-950 ring-offset-2' : ''
                    }`}
                  >
                    <img
                      src={item.url}
                      alt={item.title}
                      onError={(event) => {
                        if (item.originalUrl && event.currentTarget.src !== item.originalUrl) {
                          event.currentTarget.src = item.originalUrl;
                        }
                      }}
                      className="h-full w-full object-cover transition-opacity duration-200 group-hover:opacity-95"
                      loading="lazy"
                    />

                    {/* 选择模式下的右上角勾选框 (精确复刻图 1 右上角 ✓ 黑色圆形角标) */}
                    {isSelectMode ? (
                      <div
                        className={`absolute right-2.5 top-2.5 z-20 flex h-6 w-6 items-center justify-center rounded-md text-white transition ${
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
                        className="absolute right-2.5 top-2.5 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-slate-700 opacity-0 transition group-hover:opacity-100 hover:bg-white hover:text-slate-950 shadow-sm focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                        aria-label="更多操作"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    )}
                  </div>

                  {/* 菜单占用右侧独立网格空间，不遮挡当前图片或相邻图片 */}
                  {!isSelectMode && activeMenuId === item.id && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="relative z-50 w-full min-w-0 overflow-hidden rounded-[10px] border border-slate-200 bg-white p-1.5 shadow-lg animate-fade-in"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (onAddToConversation) {
                            onAddToConversation(item.url, item.title);
                          }
                          setActiveMenuId(null);
                        }}
                        className="flex min-h-12 w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                      >
                        <Plus size={14} className="text-slate-500" />
                        添加到聊天
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyImage(item.url)}
                        className="flex min-h-12 w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                      >
                        <Copy size={13} className="text-slate-500" />
                        复制图片
                      </button>

                      {/* 移动分类 */}
                      <button
                        type="button"
                        onClick={() => setActiveMoveCategoryId(activeMoveCategoryId === item.id ? null : item.id)}
                        className="flex min-h-12 w-full items-center justify-between rounded-md px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
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
                              className="flex min-h-10 w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
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
                        className="flex min-h-12 w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
                      >
                        <Trash2 size={13} />
                        删除
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-[24rem] flex-col items-center justify-center px-6 text-center">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 shadow-sm">
              <Download size={22} strokeWidth={1.8} />
            </div>
            <h3 className="text-lg font-semibold tracking-tight text-slate-950">
              从浏览器收集你的视觉灵感
            </h3>
            <p className="mt-2 max-w-md text-xs leading-5 text-slate-500">
              当前灵感库还是空的。安装 XC AI Clipper 后，即可把网页图片一键保存到这里，并带入 Agent 对话继续创作。
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              <a
                href={EXTENSION_DOWNLOAD_URL}
                download="xc-ai-clipper-extension.zip"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-5 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
              >
                <Download size={15} />
                下载 XC AI Clipper
              </a>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
              >
                查看安装步骤
              </button>
            </div>
            <p className="mt-3 max-w-sm text-[11px] leading-5 text-slate-400">
              下载 ZIP 并解压后，在 chrome://extensions 开启开发者模式并加载文件夹。
            </p>
          </div>
        )}
      </main>

      {/* 底部选择模式浮动工具栏 (精确复刻图 1 底部: 已选 1 项，取消/删除/发送) */}
      {isSelectMode && (
        <div className="absolute bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-6 rounded-xl border border-slate-200 bg-white px-6 py-3 shadow-[0_10px_28px_rgba(0,0,0,0.12)] animate-fade-in">
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
              className="min-h-12 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 outline-none hover:bg-slate-50 transition focus-visible:ring-2 focus-visible:ring-slate-950"
            >
              取消
            </button>

            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={handleDeleteSelectedBatch}
              title="批量删除"
              className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 outline-none hover:bg-rose-50 hover:text-rose-600 transition focus-visible:ring-2 focus-visible:ring-rose-600 disabled:opacity-40"
            >
              <Trash2 size={14} />
            </button>

            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={handleAddSelectedToConversationBatch}
              title="批量带入聊天"
              className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 outline-none hover:bg-slate-100 transition focus-visible:ring-2 focus-visible:ring-slate-950 disabled:opacity-40"
            >
              <CornerUpRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* 新建分类 Modal (精确复刻截图 2 弹窗) */}
      {showCreateCategoryModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-[0_10px_28px_rgba(0,0,0,0.14)]">
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
            className="relative flex max-h-[90vh] max-w-[90vw] flex-col items-center overflow-hidden rounded-xl bg-slate-900 border border-white/10 p-4 text-white shadow-[0_12px_36px_rgba(0,0,0,0.22)]"
          >
            {/* 右上角关闭按钮 ✕ */}
            <button
              type="button"
              onClick={() => setPreviewItem(null)}
              className="absolute right-4 top-4 z-10 flex h-12 w-12 items-center justify-center rounded-lg bg-white/10 text-white outline-none transition hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white"
              aria-label="关闭预览"
            >
              <X size={18} />
            </button>

            {/* 大图预览 */}
            <div className="flex max-h-[75vh] w-full items-center justify-center overflow-hidden rounded-lg bg-black/40">
              <img
                src={previewItem.url}
                alt={previewItem.title}
                onError={(event) => {
                  if (previewItem.originalUrl && event.currentTarget.src !== previewItem.originalUrl) {
                    event.currentTarget.src = previewItem.originalUrl;
                  }
                }}
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
                      setToastMsg('已添加到对话框');
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
                  className="flex min-h-12 items-center gap-1.5 rounded-lg bg-white/10 px-3.5 py-2 text-xs font-semibold text-white outline-none transition hover:bg-white/20 cursor-pointer focus-visible:ring-2 focus-visible:ring-white"
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
