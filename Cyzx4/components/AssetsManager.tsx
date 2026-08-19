import React, { useEffect, useState, useMemo, useRef } from 'react';
import { downloadImageFile } from '../utils/imageDownload';
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
  MoveRight,
} from 'lucide-react';
import { storageService, Project } from '../../services/storageService';
import { compressImage } from '../utils/apiHelpers';

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

// 对应功能与友好文件夹中文名映射字典
const FEATURE_TYPE_MAP: Record<string, string> = {
  UNIVERSAL_TRY_ON: '万物上身与试穿',
  MODEL: '万物上身与试穿',
  SINGLE_ITEM_TRY_ON: '单品试穿',
  RETOUCHING: '通用白底图精修',
  WHITE_BG_RETOUCH: '通用白底图精修',
  PRODUCT_VIDEO: 'AI生成产品展示视频',
  VIDEO: 'AI生成产品展示视频',
  MODEL_SCENE_FISSION: '模特场景图裂变',
  MODEL_POSE_FISSION: '模特姿势裂变',
  MODEL_ANGLE_CONTROL: '模特角度控制',
  ECOMMERCE_HERO: '生成电商主图',
  IMAGE_CLEAN: '主图生成',
  FUSION: '图像生成',
  PRODUCT_SWAP: '产品替换',
  PLANNING: '视觉策划',
  INPAINTING: '局部替换',
  SCENE_GENERATION: '场景图生成',
  STYLE_REPLICA: '风格复刻',
  MODEL_TRANSFER: '模特迁移',
  MODEL_FACE_SWAP: '模特换脸',
  MODEL_ORIGINAL_PASTE_BACK: '模特原图贴回',
  OUTFIT_EXTRACTION: '搭配提取',
  HD_UPSCALE: '高清放大',
  RATIO_QUERY: '比例查询',
};

const INITIAL_FOLDERS: AssetFolder[] = [
  {
    id: 'default',
    name: '默认文件夹',
    count: 0,
    subFolders: [],
  },
];

export const AssetsManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AssetTypeTab>('generated');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('default');
  const [folderSidebarOpen, setFolderSidebarOpen] = useState(true);
  const [folderTree, setFolderTree] = useState<AssetFolder[]>(INITIAL_FOLDERS);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set(['default']));
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // 1. 多选模式相关 State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [showMoveModal, setShowMoveModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 从真实存储数据库 IndexedDB 动态读取用户资产，并自动归类功能文件夹
  const loadRealAssets = async () => {
    setLoading(true);
    try {
      const projects = await storageService.getAllProjects();
      const realItems: AssetItem[] = [];
      const typeCounts: Record<string, number> = {};

      projects.forEach((proj: Project) => {
        const typeName = FEATURE_TYPE_MAP[proj.type] || proj.type;
        const folderKey = `type-${proj.type}`;

        // 生成的资产
        proj.assets.generated.forEach((genUrl, idx) => {
          typeCounts[typeName] = (typeCounts[typeName] || 0) + 1;
          realItems.push({
            id: `${proj.id}-gen-${idx}`,
            url: genUrl,
            name: `${typeName} - 生成图 #${idx + 1}`,
            type: typeName,
            createdAt: proj.createdAt,
            isGenerated: true,
            folderId: folderKey,
            prompt: proj.metadata.prompt,
          });
        });

        // 原始上传资产
        if (proj.assets.original) {
          proj.assets.original.forEach((origUrl, idx) => {
            realItems.push({
              id: `${proj.id}-orig-${idx}`,
              url: origUrl,
              name: `${typeName} - 上传素材 #${idx + 1}`,
              type: typeName,
              createdAt: proj.createdAt,
              isGenerated: false,
              folderId: folderKey,
            });
          });
        }
      });

      // 仅针对用户实际产生过资产的功能，动态生成子文件夹 (如果用户没用则没有文件夹)
      const dynamicSubFolders: AssetFolder[] = Object.entries(typeCounts).map(([typeName, count]) => {
        const originalTypeKey =
          Object.keys(FEATURE_TYPE_MAP).find((k) => FEATURE_TYPE_MAP[k] === typeName) || typeName;
        return {
          id: `type-${originalTypeKey}`,
          name: typeName,
          count,
        };
      });

      setFolderTree([
        {
          id: 'default',
          name: '默认文件夹',
          count: realItems.length,
          subFolders: dynamicSubFolders,
        },
      ]);

      setAssets(realItems);
    } catch (e) {
      console.warn('读取项目记录失败:', e);
      setAssets([]);
      setFolderTree(INITIAL_FOLDERS);
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
    setFolderTree((prev) => [
      {
        ...prev[0],
        subFolders: [...(prev[0].subFolders || []), newF],
      },
    ]);
  };

  // 手动上传文件 Handers
  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    try {
      const newItems: AssetItem[] = [];
      for (const file of fileList) {
        if (file.type.startsWith('image/')) {
          const { base64, mime } = await compressImage(file, 2048, 0.92);
          const dataUrl = `data:${mime};base64,${base64}`;
          newItems.push({
            id: `uploaded-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            url: dataUrl,
            name: file.name.replace(/\.[^/.]+$/, ''),
            type: '用户上传素材',
            createdAt: Date.now(),
            isGenerated: false,
            folderId: selectedFolderId,
          });
        }
      }
      setAssets((prev) => [...newItems, ...prev]);
    } catch (err) {
      console.error('上传图片失败:', err);
    }
  };

  const toggleSelectAsset = (assetId: string) => {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  };

  const handleBatchDownload = async () => {
    if (selectedAssetIds.size === 0) return;
    const selectedItems = assets.filter((a) => selectedAssetIds.has(a.id));
    for (const item of selectedItems) {
      await downloadImageFile(item.url, `${item.name}.png`);
    }
  };

  const handleBatchDelete = () => {
    if (selectedAssetIds.size === 0) return;
    if (confirm(`确定要移除选中的 ${selectedAssetIds.size} 项资产吗？`)) {
      setAssets((prev) => prev.filter((a) => !selectedAssetIds.has(a.id)));
      setSelectedAssetIds(new Set());
    }
  };

  const handleMoveToFolder = (targetFolderId: string) => {
    setAssets((prev) =>
      prev.map((a) => (selectedAssetIds.has(a.id) ? { ...a, folderId: targetFolderId } : a))
    );
    setShowMoveModal(false);
    setSelectedAssetIds(new Set());
  };

  // 根据当前激活 Tab 及选中的文件夹过滤卡片
  const displayedAssets = useMemo(() => {
    return assets.filter((item) => {
      if (activeTab === 'generated' && !item.isGenerated) return false;
      if (activeTab === 'uploaded' && item.isGenerated) return false;
      if (activeTab === 'style' && !item.name.includes('风格')) return false;

      // 如果选中了具体的功能子文件夹，精确按类型过滤
      if (selectedFolderId !== 'default') {
        return item.folderId === selectedFolderId;
      }
      return true;
    });
  }, [assets, activeTab, selectedFolderId]);

  // 当前选中的文件夹显示名称
  const currentFolderName = useMemo(() => {
    if (selectedFolderId === 'default') return '默认文件夹';
    const sub = folderTree[0]?.subFolders?.find((f) => f.id === selectedFolderId);
    return sub ? sub.name : '全部目录';
  }, [selectedFolderId, folderTree]);

  return (
    <div className="flex h-full flex-col bg-[#f8fafc] text-slate-800 dark:bg-[#0b0f17] dark:text-slate-100 overflow-hidden font-sans">
      {/* 1. TOP BAR */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/80 bg-white/95 px-6 py-3.5 backdrop-blur-md dark:border-white/10 dark:bg-[#0b0f17]/95">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('generated');
              setIsSelectionMode(false);
              setSelectedAssetIds(new Set());
            }}
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
            onClick={() => {
              setActiveTab('uploaded');
              setIsSelectionMode(false);
              setSelectedAssetIds(new Set());
            }}
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
            onClick={() => {
              setActiveTab('style');
              setIsSelectionMode(false);
              setSelectedAssetIds(new Set());
            }}
            className={`rounded-xl px-4 py-2 text-xs font-black transition ${
              activeTab === 'style'
                ? 'bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-900'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            我的风格库
          </button>
        </div>

        {/* 右侧批量控制项 */}
        <div className="flex items-center gap-2.5">
          {isSelectionMode ? (
            <>
              <span className="text-xs font-medium text-slate-400 mr-1">
                共 <strong className="font-bold text-slate-700 dark:text-slate-200">{displayedAssets.length}</strong> 个结果，
                已选 <strong className="font-black text-slate-900 dark:text-white">{selectedAssetIds.size}</strong> 项
              </span>

              <button
                type="button"
                disabled={selectedAssetIds.size === 0}
                onClick={() => setShowMoveModal(true)}
                className="rounded-full border border-slate-300 bg-white px-3.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 transition"
              >
                移动到({selectedAssetIds.size})
              </button>

              <button
                type="button"
                disabled={selectedAssetIds.size === 0}
                onClick={handleBatchDownload}
                className="rounded-full bg-slate-900 px-4 py-1 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-40 dark:bg-white dark:text-slate-900 transition"
              >
                下载({selectedAssetIds.size})
              </button>

              {selectedAssetIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleBatchDelete}
                  className="rounded-full bg-red-500/10 px-3.5 py-1 text-xs font-bold text-red-600 hover:bg-red-500/20 transition"
                >
                  删除
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsSelectionMode(false);
                  setSelectedAssetIds(new Set());
                }}
                className="rounded-full border border-slate-300 bg-white px-3.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 transition"
              >
                取消勾选
              </button>
            </>
          ) : (
            <>
              <span className="text-xs font-medium text-slate-400">
                共 <strong className="font-bold text-slate-700 dark:text-slate-200">{displayedAssets.length}</strong> 个结果
              </span>
              <button
                type="button"
                onClick={() => setIsSelectionMode(true)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 transition"
              >
                选择
              </button>
            </>
          )}
        </div>
      </header>

      {/* 面包屑路径表示 */}
      <div className="flex items-center gap-2 border-b border-slate-200/50 bg-white px-6 py-2 text-xs text-slate-400 dark:border-white/5 dark:bg-[#111622]">
        <span>当前</span>
        <span>/</span>
        <span className="font-bold text-slate-700 dark:text-slate-300">
          {currentFolderName}
        </span>
      </div>

      {/* 2. BODY CONTAINER */}
      <div className="relative flex flex-1 overflow-hidden min-h-0">
        {/* 左侧文件夹树 */}
        <div
          className={`relative flex flex-col border-r border-slate-200/80 bg-white transition-all duration-300 dark:border-white/10 dark:bg-[#111622] shrink-0 ${
            folderSidebarOpen ? 'w-56 p-3.5' : 'w-0 overflow-hidden p-0'
          }`}
        >
          {folderSidebarOpen && (
            <>
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
                        {f.count > 0 && (
                          <span className="text-[0.62rem] text-slate-400 font-normal">
                            {f.count}
                          </span>
                        )}
                      </div>

                      {/* 仅针对用户实际产生过资产的功能，展现动态子文件夹 */}
                      {hasSubs && isExpanded && (
                        <div className="pl-6 space-y-1">
                          {f.subFolders!.map((sub) => {
                            const subSelected = selectedFolderId === sub.id;
                            return (
                              <div
                                key={sub.id}
                                onClick={() => setSelectedFolderId(sub.id)}
                                className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 cursor-pointer text-[0.72rem] transition font-semibold ${
                                  subSelected
                                    ? 'bg-slate-100 text-slate-900 font-bold dark:bg-slate-800 dark:text-white'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  <Folder className="h-3.5 w-3.5 text-amber-400/80 shrink-0" />
                                  <span className="truncate">{sub.name}</span>
                                </div>
                                <span className="text-[0.6rem] text-slate-400">{sub.count}</span>
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

        {/* 侧边栏开关边缘按键 */}
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

        {/* 右侧资产图像网格 */}
        <main className="flex-1 overflow-y-auto no-scrollbar p-6 min-w-0">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {/* 我上传的资产上传项 */}
            {activeTab === 'uploaded' && (
              <label
                onClick={() => fileInputRef.current?.click()}
                className="group relative aspect-square cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-6 transition hover:border-slate-400 hover:bg-slate-100/80 dark:border-white/15 dark:bg-slate-800/30 flex flex-col items-center justify-center text-center"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleUploadFiles}
                />
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-200/80 text-slate-600 dark:bg-slate-700 dark:text-slate-200 group-hover:scale-110 transition-transform">
                  <Upload className="h-5 w-5" />
                </div>
                <p className="text-xs font-bold text-slate-800 dark:text-white">上传图片/视频</p>
                <p className="mt-1 text-[0.62rem] text-slate-400 font-medium">点击选择或拖拽到此处</p>
              </label>
            )}

            {displayedAssets.map((asset) => {
              const isChecked = selectedAssetIds.has(asset.id);

              return (
                <div
                  key={asset.id}
                  onClick={() => {
                    if (isSelectionMode) toggleSelectAsset(asset.id);
                  }}
                  className={`group relative overflow-hidden rounded-2xl border bg-white shadow-2xs transition-all duration-300 ease-out hover:-translate-y-1 dark:bg-slate-900 ${
                    isChecked
                      ? 'border-slate-900 ring-2 ring-slate-900 dark:border-white dark:ring-white'
                      : 'border-slate-200/80 hover:border-slate-300 hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)] dark:border-white/10'
                  }`}
                >
                  <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <img
                      src={asset.url}
                      alt={asset.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />

                    {isSelectionMode ? (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectAsset(asset.id);
                        }}
                        className="absolute right-2.5 top-2.5 cursor-pointer"
                      >
                        {isChecked ? (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-white bg-black/30 shadow-xs hover:bg-black/50 transition" />
                        )}
                      </div>
                    ) : (
                      <div className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-xl bg-black/60 px-2 py-1 text-white opacity-0 shadow-md backdrop-blur-md transition-opacity duration-200 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setZoomedImage(asset.url);
                          }}
                          className="rounded-md p-1 hover:bg-white/20 transition"
                          title="查看预览大图"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void downloadImageFile(asset.url, `${asset.name}.png`);
                          }}
                          className="rounded-md p-1 hover:bg-white/20 transition"
                          title="下载此素材"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
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
                    )}
                  </div>

                  <div className="p-3">
                    <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-200">
                      {asset.name}
                    </p>
                    <p className="mt-0.5 text-[0.65rem] text-slate-400 font-medium">
                      {new Date(asset.createdAt).toLocaleDateString()} · {asset.type}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {displayedAssets.length === 0 && activeTab !== 'uploaded' && (
            <div className="flex min-h-[22rem] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 p-8 text-center dark:border-white/10">
              <ImageIcon className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">该分类下暂无资产文件</p>
              <p className="mt-1 text-xs text-slate-400">您可以去“创作”模块生成商业图片或直接上传素材</p>
            </div>
          )}
        </main>
      </div>

      {/* 3. FOOTER PAGINATION */}
      <footer className="flex items-center justify-between border-t border-slate-200/80 bg-white px-6 py-2.5 text-xs text-slate-500 dark:border-white/10 dark:bg-[#0b0f17]">
        <div>
          共 <strong className="font-bold text-slate-800 dark:text-white">{displayedAssets.length}</strong> 条
        </div>

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

      {/* 4. 移动到文件夹 MODAL */}
      {showMoveModal && (
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setShowMoveModal(false)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#111622]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                移动 ({selectedAssetIds.size} 项) 到文件夹
              </h3>
              <button
                type="button"
                onClick={() => setShowMoveModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="py-3 space-y-1.5 max-h-60 overflow-y-auto no-scrollbar">
              {folderTree[0]?.subFolders?.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleMoveToFolder(f.id)}
                  className="flex w-full items-center justify-between rounded-xl p-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition"
                >
                  <span className="flex items-center gap-2">
                    <Folder className="h-4 w-4 text-amber-500" />
                    {f.name}
                  </span>
                  <MoveRight className="h-3.5 w-3.5 text-slate-400" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX MODAL */}
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
