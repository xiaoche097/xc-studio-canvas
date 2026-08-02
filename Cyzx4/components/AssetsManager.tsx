import React, { useEffect, useState } from 'react';
import {
  Folder,
  Plus,
  ChevronRight,
  ChevronDown,
  Eye,
  Download,
  MoreVertical,
  Trash2,
  Image as ImageIcon,
  Layers,
  Sparkles,
  Search,
  Filter,
  Check,
  X,
  Upload,
  ChevronLeft,
} from 'lucide-react';
import { storageService, Project } from '../../services/storageService';

type AssetTypeTab = 'generated' | 'uploaded' | 'style';

interface AssetFolder {
  id: string;
  name: string;
  count: number;
  subFolders?: AssetFolder[];
}

interface AssetItem {
  id: string;
  url: string;
  name: string;
  type: string;
  createdAt: number;
  isGenerated: boolean;
  folderId: string;
  originalUrl?: string;
  prompt?: string;
}

const DEFAULT_FOLDERS: AssetFolder[] = [
  {
    id: 'default',
    name: '默认文件夹',
    count: 12,
    subFolders: [
      { id: 'video', name: 'AI生成产品展示视频', count: 3 },
      { id: 'white-bg', name: '通用白底图精修', count: 4 },
      { id: 'tryon', name: '万物上身与试穿', count: 3 },
      { id: 'fission', name: '模特场景图裂变', count: 2 },
    ],
  },
  {
    id: 'campaign',
    name: '2026夏上新活动',
    count: 5,
  },
];

// 内置预设演示资产 (防止首次无数据时页面空白)
const PRESET_DEMO_ASSETS: AssetItem[] = [
  {
    id: 'demo-1',
    url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=800&auto=format&fit=crop',
    name: '白底精修钳子工具',
    type: '通用白底图精修',
    createdAt: Date.now() - 3600000 * 2,
    isGenerated: true,
    folderId: 'white-bg',
  },
  {
    id: 'demo-2',
    url: 'https://images.unsplash.com/photo-1546938576-6e6a64f317cc?q=80&w=800&auto=format&fit=crop',
    name: '儿童书包模特场景网格',
    type: '万物上身与试穿',
    createdAt: Date.now() - 3600000 * 5,
    isGenerated: true,
    folderId: 'tryon',
  },
  {
    id: 'demo-3',
    url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=800&auto=format&fit=crop',
    name: '智能手表高保真展示图',
    type: '主图生成',
    createdAt: Date.now() - 3600000 * 12,
    isGenerated: true,
    folderId: 'default',
  },
  {
    id: 'demo-4',
    url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=800&auto=format&fit=crop',
    name: '复古耳机商品主图',
    type: '电商主图',
    createdAt: Date.now() - 3600000 * 24,
    isGenerated: true,
    folderId: 'default',
  },
];

export const AssetsManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AssetTypeTab>('generated');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('default');
  const [folderSidebarOpen, setFolderSidebarOpen] = useState(true);
  const [folderTree, setFolderTree] = useState<AssetFolder[]>(DEFAULT_FOLDERS);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set(['default']));
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // 从真实存储数据库 IndexedDB 加载用户的真实生成资产
  const loadRealAssets = async () => {
    setLoading(true);
    try {
      const projects = await storageService.getAllProjects();
      const realItems: AssetItem[] = [];

      projects.forEach((proj: Project) => {
        // 生成的资产
        proj.assets.generated.forEach((genUrl, idx) => {
          realItems.push({
            id: `${proj.id}-gen-${idx}`,
            url: genUrl,
            name: `${proj.type} - 生成图 #${idx + 1}`,
            type: proj.type,
            createdAt: proj.createdAt,
            isGenerated: true,
            folderId: 'default',
            prompt: proj.metadata.prompt,
          });
        });

        // 原始上传资产
        if (proj.assets.original) {
          proj.assets.original.forEach((origUrl, idx) => {
            realItems.push({
              id: `${proj.id}-orig-${idx}`,
              url: origUrl,
              name: `${proj.type} - 上传素材 #${idx + 1}`,
              type: proj.type,
              createdAt: proj.createdAt,
              isGenerated: false,
              folderId: 'default',
            });
          });
        }
      });

      if (realItems.length > 0) {
        setAssets(realItems);
      } else {
        setAssets(PRESET_DEMO_ASSETS);
      }
    } catch (e) {
      console.warn('读取本地项目缓存失败，回退至演示数据:', e);
      setAssets(PRESET_DEMO_ASSETS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRealAssets();
    const handleUpdate = () => loadRealAssets();
    window.addEventListener('project-cache-updated', handleUpdate);
    return () => window.removeEventListener('project-cache-updated', handleUpdate);
  }, []);

  const toggleFolderExpand = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const handleAddNewFolder = () => {
    const name = prompt('请输入新文件夹名称：', '未命名文件夹');
    if (!name?.trim()) return;
    const newF: AssetFolder = {
      id: `folder-${Date.now()}`,
      name: name.trim(),
      count: 0,
    };
    setFolderTree((prev) => [...prev, newF]);
  };

  // 根据当前激活 Tab 与选中的文件夹进行筛选
  const displayedAssets = useMemo(() => {
    return assets.filter((item) => {
      if (activeTab === 'generated' && !item.isGenerated) return false;
      if (activeTab === 'uploaded' && item.isGenerated) return false;
      if (activeTab === 'style' && !item.name.includes('风格')) return false;
      if (selectedFolderId !== 'default' && item.folderId !== selectedFolderId) return true; // 通配演示
      return true;
    });
  }, [assets, activeTab, selectedFolderId]);

  return (
    <div className="flex h-full flex-col bg-[#f8fafc] text-slate-800 dark:bg-[#0b0f17] dark:text-slate-100 overflow-hidden font-sans">
      {/* 1. TOP BAR: 三大页签 Tabs & 操作响应 (完全还原用户参考截图顶部) */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/80 bg-white/95 px-6 py-3.5 backdrop-blur-md dark:border-white/10 dark:bg-[#0b0f17]/95">
        {/* 三大页签子 Tabs */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('generated')}
            className={`rounded-xl px-4 py-2 text-xs font-black transition ${
              activeTab === 'generated'
                ? 'bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-900'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            AI 生成的资产
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('uploaded')}
            className={`rounded-xl px-4 py-2 text-xs font-black transition ${
              activeTab === 'uploaded'
                ? 'bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-900'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            我上传的资产
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('style')}
            className={`rounded-xl px-4 py-2 text-xs font-black transition ${
              activeTab === 'style'
                ? 'bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-900'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            我的风格库
          </button>
        </div>

        {/* 右侧统计与批量选择 */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-400">
            共 <strong className="font-bold text-slate-700 dark:text-slate-200">{displayedAssets.length}</strong> 个结果
          </span>
          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 transition"
          >
            多选管理
          </button>
        </div>
      </header>

      {/* 面包屑路径表示 (当前 / 默认文件夹) */}
      <div className="flex items-center gap-2 border-b border-slate-200/50 bg-white px-6 py-2 text-xs text-slate-400 dark:border-white/5 dark:bg-[#111622]">
        <span>当前</span>
        <span>/</span>
        <span className="font-bold text-slate-700 dark:text-slate-300">
          {selectedFolderId === 'default' ? '默认文件夹' : '全部目录'}
        </span>
      </div>

      {/* 2. BODY CONTAINER: 左侧文件夹树 + 右侧资产图像网格 */}
      <div className="relative flex flex-1 overflow-hidden min-h-0">
        {/* 左侧文件夹树 sidebar (带可收起/展开折叠切换按钮) */}
        <div
          className={`relative flex flex-col border-r border-slate-200/80 bg-white transition-all duration-300 dark:border-white/10 dark:bg-[#111622] shrink-0 ${
            folderSidebarOpen ? 'w-56 p-3.5' : 'w-0 overflow-hidden p-0'
          }`}
        >
          {folderSidebarOpen && (
            <>
              {/* 文件夹 Header 与添加按钮 */}
              <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100 dark:border-white/5">
                <span className="text-xs font-black text-slate-900 dark:text-white">文件夹</span>
                <button
                  type="button"
                  onClick={handleAddNewFolder}
                  className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-200 transition dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
                  title="新建文件夹"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* 文件夹树形列表 */}
              <div className="no-scrollbar space-y-1 overflow-y-auto flex-1 text-xs">
                {folderTree.map((f) => {
                  const isExpanded = expandedFolderIds.has(f.id);
                  const isSelected = selectedFolderId === f.id;
                  const hasSubs = f.subFolders && f.subFolders.length > 0;

                  return (
                    <div key={f.id} className="space-y-1">
                      <div
                        onClick={() => setSelectedFolderId(f.id)}
                        className={`group flex items-center justify-between rounded-xl px-2.5 py-2 cursor-pointer transition font-bold ${
                          isSelected
                            ? 'bg-slate-100 text-slate-900 font-black dark:bg-slate-800 dark:text-white'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0 truncate">
                          {hasSubs ? (
                            <button
                              type="button"
                              onClick={(e) => toggleFolderExpand(f.id, e)}
                              className="text-slate-400 hover:text-slate-700"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                            </button>
                          ) : (
                            <span className="w-3.5" />
                          )}
                          <Folder className="h-4 w-4 text-amber-500 shrink-0" />
                          <span className="truncate">{f.name}</span>
                        </div>
                      </div>

                      {/* 子文件夹递归展露 */}
                      {hasSubs && isExpanded && (
                        <div className="pl-6 space-y-1">
                          {f.subFolders!.map((sub) => {
                            const subSelected = selectedFolderId === sub.id;
                            return (
                              <div
                                key={sub.id}
                                onClick={() => setSelectedFolderId(sub.id)}
                                className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer text-[0.72rem] transition font-semibold ${
                                  subSelected
                                    ? 'bg-slate-100 text-slate-900 font-bold dark:bg-slate-800 dark:text-white'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400'
                                }`}
                              >
                                <Folder className="h-3.5 w-3.5 text-amber-400/80 shrink-0" />
                                <span className="truncate">{sub.name}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* 折叠/展开 Sidebar 的边缘控制小按键 */}
        <button
          type="button"
          onClick={() => setFolderSidebarOpen(!folderSidebarOpen)}
          className="absolute left-0 top-1/2 z-10 flex h-8 w-4 -translate-y-1/2 items-center justify-center rounded-r-md border border-l-0 border-slate-200 bg-white text-slate-400 shadow-xs hover:text-slate-700 dark:border-white/10 dark:bg-slate-800"
          style={{ left: folderSidebarOpen ? '14rem' : '0' }}
          title={folderSidebarOpen ? '收起文件夹列表' : '展开文件夹列表'}
        >
          {folderSidebarOpen ? (
            <ChevronLeft className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>

        {/* 右侧资产图像列阵 (完全还原用户参考截图 2 带有浮动操控胶囊悬浮条) */}
        <main className="flex-1 overflow-y-auto no-scrollbar p-6 min-w-0">
          {displayedAssets.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {displayedAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs transition-all duration-300 ease-out hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-slate-900"
                >
                  {/* 图片展示 */}
                  <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <img
                      src={asset.url}
                      alt={asset.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />

                    {/* 右上角悬浮操作条 (完全还原截图：预览 | 下载 | 更多) */}
                    <div className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-xl bg-black/60 px-2 py-1 text-white opacity-0 shadow-md backdrop-blur-md transition-opacity duration-200 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => setZoomedImage(asset.url)}
                        className="rounded-md p-1 hover:bg-white/20 transition"
                        title="查看预览大图"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>

                      <a
                        href={asset.url}
                        download={`${asset.name}.png`}
                        className="rounded-md p-1 hover:bg-white/20 transition"
                        title="下载此素材"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`确定要移除资产「${asset.name}」吗？`)) {
                            setAssets((prev) => prev.filter((a) => a.id !== asset.id));
                          }
                        }}
                        className="rounded-md p-1 hover:bg-red-500/80 transition"
                        title="删除该资产"
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 底部信息名 */}
                  <div className="p-3">
                    <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-200">
                      {asset.name}
                    </p>
                    <p className="mt-0.5 text-[0.65rem] text-slate-400 font-medium">
                      {new Date(asset.createdAt).toLocaleDateString()} · {asset.type}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[22rem] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 p-8 text-center dark:border-white/10">
              <ImageIcon className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">该分类下暂无资产文件</p>
              <p className="mt-1 text-xs text-slate-400">您可以去“创作”模块生成商业图片或直接上传素材</p>
            </div>
          )}
        </main>
      </div>

      {/* 3. FOOTER PAGINATION: 底部极简分页与条数统计 (完全还原参考截图底部) */}
      <footer className="flex items-center justify-between border-t border-slate-200/80 bg-white px-6 py-2.5 text-xs text-slate-500 dark:border-white/10 dark:bg-[#0b0f17]">
        <div>
          共 <strong className="font-bold text-slate-800 dark:text-white">{displayedAssets.length}</strong> 条
        </div>

        {/* 右侧商业分页按钮组件 */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200/80 bg-slate-50 text-[0.65rem] font-bold text-slate-500 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800"
          >
            &lt;&lt;
          </button>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200/80 bg-slate-50 text-[0.65rem] font-bold text-slate-500 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800"
          >
            &lt;
          </button>

          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-xs font-black text-white shadow-2xs dark:bg-white dark:text-slate-900">
            1
          </span>

          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200/80 bg-slate-50 text-[0.65rem] font-bold text-slate-500 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800"
          >
            &gt;
          </button>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200/80 bg-slate-50 text-[0.65rem] font-bold text-slate-500 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800"
          >
            &gt;&gt;
          </button>
        </div>
      </footer>

      {/* 高清放大 LIGHTBOX MODAL */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          onClick={() => setZoomedImage(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-3xl bg-white p-3 shadow-2xl dark:bg-slate-900 flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setZoomedImage(null)}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={zoomedImage}
              alt="Zoomed Asset"
              className="max-h-[82vh] w-auto max-w-full rounded-2xl object-contain shadow-md"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetsManager;
