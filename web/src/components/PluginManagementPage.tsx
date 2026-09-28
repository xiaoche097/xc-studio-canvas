import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Upload,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  FileCode,
  Check,
  Copy,
  AlertCircle,
  Trash2,
  Lock,
  X,
  FileText,
  CloudUpload,
  CheckCircle2,
  Plug,
  ExternalLink,
  Info
} from 'lucide-react';
import { TEXT_PROTOCOLS, IMAGE_PROTOCOLS } from '../protocols/catalog';
import { StandardProtocolDefinition } from '../protocols/types';

export interface InstalledPluginItem {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  category: 'text' | 'image' | 'custom';
  typeLabel: string;
  scopeLabel: string;
  isSystem: boolean;
  enabled: boolean;
  installedAt?: number;
  manifest?: any;
}

const CUSTOM_PLUGINS_KEY = 'custom_installed_plugins_v1';
const PLUGIN_STATUS_KEY_PREFIX = 'plugin_enabled_status_';

interface PluginManagementPageProps {
  onNotify?: (msg: string) => void;
}

export const PluginManagementPage: React.FC<PluginManagementPageProps> = ({ onNotify }) => {
  // 状态
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'text' | 'image' | 'custom'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 自定义上传插件与状态字典
  const [customPlugins, setCustomPlugins] = useState<InstalledPluginItem[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, boolean>>({});

  // 弹窗状态
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<'upload' | 'spec'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 初始加载自定义插件与状态
  const loadPlugins = () => {
    try {
      const stored = localStorage.getItem(CUSTOM_PLUGINS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCustomPlugins(parsed);
        }
      }
    } catch {}

    // 读取所有状态
    const newStatusMap: Record<string, boolean> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PLUGIN_STATUS_KEY_PREFIX)) {
        const id = key.replace(PLUGIN_STATUS_KEY_PREFIX, '');
        newStatusMap[id] = localStorage.getItem(key) !== 'false';
      }
    }
    setStatusMap(newStatusMap);
  };

  useEffect(() => {
    loadPlugins();
  }, []);

  // 聚合所有插件：真实文本协议 (33) + 真实图片协议 (27) + 自定义上传插件
  const allPlugins = useMemo<InstalledPluginItem[]>(() => {
    const textItems: InstalledPluginItem[] = TEXT_PROTOCOLS.map((p) => {
      const id = p.providerId || p.pluginId;
      const isEnabled = statusMap[id] !== undefined ? statusMap[id] : true;
      return {
        id,
        name: p.name,
        version: p.version ? `v${p.version.replace(/^v/, '')}` : 'v1.0.0',
        author: p.vendor || '系统官方',
        description: p.description || `${p.name} 文本模型协议插件`,
        category: 'text',
        typeLabel: '文本协议',
        scopeLabel: '全局生效 (管理员统一控制)',
        isSystem: true,
        enabled: isEnabled,
      };
    });

    const imageItems: InstalledPluginItem[] = IMAGE_PROTOCOLS.map((p) => {
      const id = p.providerId || p.pluginId;
      const isEnabled = statusMap[id] !== undefined ? statusMap[id] : true;
      return {
        id,
        name: p.name,
        version: p.version ? `v${p.version.replace(/^v/, '')}` : 'v1.0.0',
        author: p.vendor || '系统官方',
        description: p.description || `${p.name} 图像生成与视觉能力协议插件`,
        category: 'image',
        typeLabel: '图像协议',
        scopeLabel: '全局生效 (管理员统一控制)',
        isSystem: true,
        enabled: isEnabled,
      };
    });

    const customItems: InstalledPluginItem[] = customPlugins.map((c) => {
      const isEnabled = statusMap[c.id] !== undefined ? statusMap[c.id] : c.enabled;
      return {
        ...c,
        enabled: isEnabled,
      };
    });

    return [...textItems, ...imageItems, ...customItems];
  }, [customPlugins, statusMap]);

  // 统计指标数据
  const stats = useMemo(() => {
    const total = allPlugins.length;
    const textCount = allPlugins.filter((p) => p.category === 'text').length;
    const imageCount = allPlugins.filter((p) => p.category === 'image').length;
    const customCount = allPlugins.filter((p) => p.category === 'custom').length;
    const disabledCount = allPlugins.filter((p) => !p.enabled).length;

    return {
      total,
      textCount,
      imageCount,
      customCount,
      disabledCount,
    };
  }, [allPlugins]);

  // 筛选与检索
  const filteredPlugins = useMemo(() => {
    return allPlugins.filter((item) => {
      // 类型筛选
      if (typeFilter !== 'all') {
        if (typeFilter === 'text' && item.category !== 'text') return false;
        if (typeFilter === 'image' && item.category !== 'image') return false;
        if (typeFilter === 'custom' && item.category !== 'custom') return false;
      }

      // 状态筛选
      if (statusFilter === 'enabled' && !item.enabled) return false;
      if (statusFilter === 'disabled' && item.enabled) return false;

      // 搜索框筛选
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const m1 = item.name.toLowerCase().includes(q);
        const m2 = item.id.toLowerCase().includes(q);
        const m3 = item.author.toLowerCase().includes(q);
        const m4 = item.description.toLowerCase().includes(q);
        if (!m1 && !m2 && !m3 && !m4) return false;
      }

      return true;
    });
  }, [allPlugins, typeFilter, statusFilter, searchQuery]);

  // 分页切片
  const totalItems = filteredPlugins.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedPlugins = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize;
    return filteredPlugins.slice(start, start + pageSize);
  }, [filteredPlugins, validCurrentPage, pageSize]);

  // 切换插件开关
  const handleToggleStatus = (id: string, currentEnabled: boolean) => {
    const next = !currentEnabled;
    try {
      localStorage.setItem(`${PLUGIN_STATUS_KEY_PREFIX}${id}`, String(next));
      setStatusMap((prev) => ({ ...prev, [id]: next }));
      onNotify?.(next ? '插件已开启并投入运行' : '插件已在平台禁用');
    } catch {}
  };

  // 卸载自定义插件
  const handleDeleteCustomPlugin = (id: string, name: string) => {
    if (window.confirm(`确定要卸载自定义插件「${name}」吗？`)) {
      const updated = customPlugins.filter((c) => c.id !== id);
      setCustomPlugins(updated);
      try {
        localStorage.setItem(CUSTOM_PLUGINS_KEY, JSON.stringify(updated));
        localStorage.removeItem(`${PLUGIN_STATUS_KEY_PREFIX}${id}`);
      } catch {}
      onNotify?.(`已成功卸载插件 ${name}`);
    }
  };

  // 刷新列表
  const handleRefresh = () => {
    setIsRefreshing(true);
    loadPlugins();
    setTimeout(() => {
      setIsRefreshing(false);
      onNotify?.('插件列表已刷新');
    }, 400);
  };

  // 文件解析安装
  const handleProcessUploadedFile = async (file: File) => {
    setUploadError(null);
    setUploadSuccess(null);

    if (file.size > 48 * 1024 * 1024) {
      setUploadError('插件包体积不能超过 48 MiB');
      return;
    }

    try {
      let manifestText = '';

      // 支持直接读取 manifest.json
      if (file.name.endsWith('.json')) {
        manifestText = await file.text();
      } else {
        // 如果是 .yingce-plugin 或 .zip 包，先尝试提取文本
        // 尝试用 FileReader 读取文本寻找 JSON 结构
        const buffer = await file.arrayBuffer();
        const textDecoder = new TextDecoder('utf-8', { fatal: false });
        const rawText = textDecoder.decode(buffer);
        
        // 寻找 manifest.json 声明块
        const manifestIndex = rawText.indexOf('"apiversion"');
        if (manifestIndex !== -1) {
          // 截取 JSON 区域
          const start = rawText.lastIndexOf('{', manifestIndex);
          if (start !== -1) {
            let depth = 0;
            let end = -1;
            for (let i = start; i < rawText.length; i++) {
              if (rawText[i] === '{') depth++;
              else if (rawText[i] === '}') {
                depth--;
                if (depth === 0) {
                  end = i + 1;
                  break;
                }
              }
            }
            if (end !== -1) {
              manifestText = rawText.slice(start, end);
            }
          }
        }

        if (!manifestText) {
          // 兜底提示
          throw new Error('未在插件包根目录下识别到合规的 manifest.json，请确认是否为标准的 .yingce-plugin 规范包。');
        }
      }

      const manifest = JSON.parse(manifestText);
      if (!manifest.id || !manifest.name) {
        throw new Error('Manifest 缺少必需的 id 或 name 字段');
      }

      // 构造新插件项
      const newPlugin: InstalledPluginItem = {
        id: manifest.id.toLowerCase().trim(),
        name: manifest.name.trim(),
        version: manifest.version ? `v${manifest.version.replace(/^v/, '')}` : 'v1.0.0',
        author: manifest.author || '外部开发者',
        description: manifest.description || '自定义安装扩展插件',
        category: 'custom',
        typeLabel: '自定义插件',
        scopeLabel: '用户自主启用',
        isSystem: false,
        enabled: true,
        installedAt: Date.now(),
        manifest,
      };

      // 检查重复
      const existingIndex = customPlugins.findIndex((c) => c.id === newPlugin.id);
      let updated: InstalledPluginItem[] = [];
      if (existingIndex >= 0) {
        updated = [...customPlugins];
        updated[existingIndex] = newPlugin;
      } else {
        updated = [newPlugin, ...customPlugins];
      }

      setCustomPlugins(updated);
      localStorage.setItem(CUSTOM_PLUGINS_KEY, JSON.stringify(updated));
      setUploadSuccess(`插件「${newPlugin.name}」安装成功！已进入插件中心。`);
      onNotify?.(`插件「${newPlugin.name}」安装成功`);

      setTimeout(() => {
        setIsUploadModalOpen(false);
        setUploadSuccess(null);
      }, 1200);
    } catch (err: any) {
      setUploadError(err.message || '插件包格式解析失败，请检查文件是否为标准 UTF-8 JSON 或 .yingce-plugin 包。');
    }
  };

  // 规范清单 JSON 示例代码（来自图 3 规范）
  const SPEC_SAMPLE_JSON = `{
  "apiversion": "yingce.plugin/v1",
  "id": "acme-comfyui",
  "name": "Acme ComfyUI",
  "version": "1.0.0",
  "author": "Acme",
  "description": "通信工作流转换与视觉生成能力",
  "permissions": ["generation.run", "media.read"],
  "configuration": {
    "fields": [
      { "name": "apiKey", "type": "secret", "label": "API Token", "required": true }
    ]
  },
  "contributes": {
    "providers": [
      {
        "id": "acme-comfyui",
        "label": "Acme Comfyui",
        "capabilities": ["video"],
        "scopes": ["user.custom-channel", "canvas"],
        "baseUrl": "https://api.example.com",
        "auth": { "type": "bearer", "field": "apiKey" },
        "create": { "method": "POST", "path": "/workflows/{{model}}", "fields": { "prompt": "request.prompt", "duration": "request.duration" } },
        "poll": { "method": "GET", "path": "/tasks/{{taskId}}" },
        "response": { "taskIdPaths": ["data.task_id"], "statusPaths": ["data.status"], "resultPaths": ["data.results"], "resultKind": "video", "resultEphemeral": true }
      }
    ],
    "workflows": [
      {
        "id": "minimax-h3",
        "label": "MiniMax H3 文本视频",
        "providerId": "acme-comfyui",
        "capability": "video",
        "parameters": [
          { "name": "duration", "type": "number", "required": true },
          { "name": "resolution", "type": "string", "values": ["720p", "1080p"] }
        ],
        "defaults": { "duration": 5, "resolution": "720p" }
      }
    ]
  }
}`;

  const handleCopySpec = () => {
    navigator.clipboard.writeText(SPEC_SAMPLE_JSON);
    onNotify?.('已复制清单示例到剪贴板');
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full bg-[#FAFAFC] dark:bg-[#07090E] overflow-hidden text-slate-800 dark:text-slate-100">
      {/* 顶部标题栏 (参考图 1) */}
      <div className="w-full px-8 py-5 border-b border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#0D1117] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-400">
            <span>平台资源</span>
            <span>/</span>
            <span className="text-slate-900 dark:text-white font-bold">插件管理</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mt-1 tracking-tight">
            插件管理
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            管理平台可用插件、自定义插件安装与用户启用范围
          </p>
        </div>

        {/* 右侧动作按钮 */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-sm font-bold transition-all shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>刷新</span>
          </button>

          <button
            onClick={() => {
              setIsUploadModalOpen(true);
              setActiveModalTab('upload');
              setUploadError(null);
              setUploadSuccess(null);
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#5051F9] hover:bg-[#4344E0] text-white text-sm font-bold shadow-md shadow-[#5051F9]/20 transition-all cursor-pointer"
          >
            <Upload className="h-4 w-4" />
            <span>上传插件</span>
          </button>
        </div>
      </div>

      {/* 主滚动区域 */}
      <div className="flex-1 overflow-y-auto w-full px-8 py-6 space-y-6 custom-scrollbar">
        {/* 顶部 KPI 色块指标卡片 (完全对应图 1 顶部，纯真实统计) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* 全部插件 */}
          <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#0D1117] shadow-sm flex flex-col justify-between">
            <span className="text-xs font-bold text-slate-400">全部插件</span>
            <div className="mt-2 text-3xl font-black text-slate-900 dark:text-white font-mono">
              {stats.total}
            </div>
            <div className="mt-2 text-[11px] text-slate-400">已接入系统与定制</div>
          </div>

          {/* 文本对话协议 */}
          <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#0D1117] shadow-sm flex flex-col justify-between">
            <span className="text-xs font-bold text-slate-400">文本对话协议</span>
            <div className="mt-2 text-3xl font-black text-blue-600 dark:text-blue-400 font-mono">
              {stats.textCount}
            </div>
            <div className="mt-2 text-[11px] text-slate-400">标准化对话模型协议</div>
          </div>

          {/* 图像生成协议 */}
          <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#0D1117] shadow-sm flex flex-col justify-between">
            <span className="text-xs font-bold text-slate-400">图像生成协议</span>
            <div className="mt-2 text-3xl font-black text-purple-600 dark:text-purple-400 font-mono">
              {stats.imageCount}
            </div>
            <div className="mt-2 text-[11px] text-slate-400">图像策划与视觉协议</div>
          </div>

          {/* 自定义插件 */}
          <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#0D1117] shadow-sm flex flex-col justify-between">
            <span className="text-xs font-bold text-slate-400">自定义插件</span>
            <div className="mt-2 text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {stats.customCount}
            </div>
            <div className="mt-2 text-[11px] text-slate-400">自主上传的扩展包</div>
          </div>

          {/* 平台已禁用 */}
          <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#0D1117] shadow-sm flex flex-col justify-between">
            <span className="text-xs font-bold text-slate-400">平台已禁用</span>
            <div className={`mt-2 text-3xl font-black font-mono ${stats.disabledCount > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
              {stats.disabledCount}
            </div>
            <div className="mt-2 text-[11px] text-slate-400">当前被关闭的插件</div>
          </div>
        </div>

        {/* 搜索与过滤工具栏 (参考图 1) */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#0D1117] shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            {/* 搜索框 */}
            <div className="relative min-w-[280px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="搜索插件名称、ID 或作者"
                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-9 pr-3.5 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-[#5051F9]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* 类型下拉筛选 */}
            <div className="relative">
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="appearance-none pl-3.5 pr-8 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="all">全部类型</option>
                <option value="text">文本对话协议</option>
                <option value="image">图像生成协议</option>
                <option value="custom">自定义插件</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* 状态下拉筛选 */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="appearance-none pl-3.5 pr-8 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="all">全部状态</option>
                <option value="enabled">已启用</option>
                <option value="disabled">已禁用</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="text-xs text-slate-400 font-medium">
            共找到 <strong className="text-slate-700 dark:text-slate-200 font-bold">{totalItems}</strong> 项符合条件
          </div>
        </div>

        {/* 插件数据表格 (完全参考图 1 优雅布局) */}
        <div className="w-full rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#0D1117] shadow-sm overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[950px]">
              <thead className="bg-[#FBFBFC] dark:bg-[#12161F] text-slate-500 font-bold border-b border-slate-200/80 dark:border-white/10 text-xs">
                <tr>
                  <th className="py-3.5 px-6 w-[45%]">插件</th>
                  <th className="py-3.5 px-4 w-[15%]">类型</th>
                  <th className="py-3.5 px-4 w-[20%]">作用范围</th>
                  <th className="py-3.5 px-4 w-[12%]">平台状态</th>
                  <th className="py-3.5 px-6 w-[8%] text-right">部署</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-sm">
                {paginatedPlugins.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-slate-400 text-sm">
                      没有符合条件的协议或插件
                    </td>
                  </tr>
                ) : (
                  paginatedPlugins.map((plugin) => (
                    <tr
                      key={plugin.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      {/* 1. 插件信息列 */}
                      <td className="py-4 px-6">
                        <div className="flex items-start gap-3.5">
                          {/* 统一规范高级色块图标 */}
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 text-xs font-black ${
                              plugin.category === 'text'
                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                : plugin.category === 'image'
                                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            {plugin.name.slice(0, 2).toUpperCase()}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-white tracking-tight">
                                {plugin.name}
                              </span>
                              <span className="text-[11px] font-mono font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-500">
                                {plugin.version}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                              <span className="font-mono text-slate-500 dark:text-slate-400 select-all">
                                {plugin.id}
                              </span>
                              <span>·</span>
                              <span className="truncate max-w-[340px]" title={plugin.description}>
                                {plugin.description}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. 类型列 (色块胶囊) */}
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                            plugin.category === 'text'
                              ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
                              : plugin.category === 'image'
                              ? 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400'
                              : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              plugin.category === 'text'
                                ? 'bg-blue-500'
                                : plugin.category === 'image'
                                ? 'bg-purple-500'
                                : 'bg-emerald-500'
                            }`}
                          />
                          <span>{plugin.typeLabel}</span>
                        </span>
                      </td>

                      {/* 3. 作用范围列 */}
                      <td className="py-4 px-4 text-xs font-medium text-slate-600 dark:text-slate-300">
                        <div>{plugin.scopeLabel.split(' ')[0]}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {plugin.scopeLabel.split(' ')[1] || '系统通道受控'}
                        </div>
                      </td>

                      {/* 4. 平台状态列 (Switch 开关) */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(plugin.id, plugin.enabled)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              plugin.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                plugin.enabled ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          <span
                            className={`text-xs font-bold ${
                              plugin.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                            }`}
                          >
                            {plugin.enabled ? '已开启' : '已禁用'}
                          </span>
                        </div>
                      </td>

                      {/* 5. 部署 / 操作列 */}
                      <td className="py-4 px-6 text-right">
                        {plugin.isSystem ? (
                          <span
                            className="inline-flex items-center text-slate-300 dark:text-slate-600 p-1"
                            title="系统原生协议不可卸载"
                          >
                            <Lock className="w-4 h-4" />
                          </span>
                        ) : (
                          <button
                            onClick={() => handleDeleteCustomPlugin(plugin.id, plugin.name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                            title="卸载该自定义插件"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 表格底部标准分页条 (参考图 1 底部) */}
          <div className="px-6 py-4 border-t border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-medium text-slate-500">
            <div className="flex items-center gap-3">
              <span>
                {totalItems === 0
                  ? '0 / 共 0 条'
                  : `${(validCurrentPage - 1) * pageSize + 1}-${Math.min(
                      validCurrentPage * pageSize,
                      totalItems
                    )} / 共 ${totalItems} 条`}
              </span>

              <div className="relative">
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="appearance-none pl-2.5 pr-6 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-600 dark:text-slate-300 focus:outline-none"
                >
                  <option value={10}>10 条/页</option>
                  <option value={20}>20 条/页</option>
                  <option value={50}>50 条/页</option>
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* 页码控制器 */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={validCurrentPage <= 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {Array.from({ length: totalPages }).map((_, idx) => {
                const p = idx + 1;
                // 最多显示前后若干页
                if (totalPages > 7) {
                  if (p !== 1 && p !== totalPages && Math.abs(p - validCurrentPage) > 2) {
                    if (p === 2 || p === totalPages - 1) {
                      return (
                        <span key={p} className="px-1 text-slate-400">
                          ...
                        </span>
                      );
                    }
                    return null;
                  }
                }

                return (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`min-w-[28px] h-7 px-2 rounded-lg font-bold text-xs transition-colors ${
                      validCurrentPage === p
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                        : 'border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={validCurrentPage >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 上传插件 Modal 弹窗 (严格按照图 2 和 图 3 还原) */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0D1117] w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* 弹窗顶部栏 (图 2 / 图 3 统一头部) */}
            <div className="p-6 pb-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between shrink-0">
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                上传插件
              </h2>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab 胶囊切换栏 */}
            <div className="px-6 pt-3 pb-3 border-b border-slate-100 dark:border-white/5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-white/5 rounded-xl text-xs font-bold">
                <button
                  onClick={() => setActiveModalTab('upload')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                    activeModalTab === 'upload'
                      ? 'bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <CloudUpload className="w-4 h-4" />
                  <span>安装插件包</span>
                </button>
                <button
                  onClick={() => setActiveModalTab('spec')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                    activeModalTab === 'spec'
                      ? 'bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>开发规范与示例</span>
                </button>
              </div>

              {/* 右侧沙箱受控隔离徽标 */}
              {activeModalTab === 'upload' ? (
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span>沙箱受控隔离</span>
                </div>
              ) : (
                <button
                  onClick={handleCopySpec}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>复制清单示例</span>
                </button>
              )}
            </div>

            {/* TAB 1: 安装插件包 (完全复刻图 2) */}
            {activeModalTab === 'upload' && (
              <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    安装插件包
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    选择统一站点插件包，安装后会立即进入插件中心。
                  </p>
                </div>

                {/* 拖拽或点击上传大区域 */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleProcessUploadedFile(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-[#5051F9] bg-[#5051F9]/5'
                      : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 bg-slate-50/50 dark:bg-white/[0.01]'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".yingce-plugin,.zip,.json"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleProcessUploadedFile(e.target.files[0]);
                      }
                    }}
                  />

                  <div className="w-14 h-14 rounded-2xl bg-white dark:bg-white/5 shadow-sm border border-slate-100 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300 mb-4">
                    <CloudUpload className="w-7 h-7" />
                  </div>

                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    点击选择插件文件，也可拖拽到此处
                  </div>
                  <div className="text-xs text-slate-400 mt-1.5 font-medium">
                    支持 .yingce-plugin 包 · 大小不超过 48 MiB
                  </div>
                </div>

                {/* 错误或成功提示 */}
                {uploadError && (
                  <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{uploadError}</span>
                  </div>
                )}
                {uploadSuccess && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{uploadSuccess}</span>
                  </div>
                )}

                {/* 安全与权限说明 (图 2 底部提示) */}
                <div className="flex items-start gap-2.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/[0.02] p-3.5 rounded-xl border border-slate-100 dark:border-white/5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>
                    上传前请确认插件来源可信。Web 入口只能进入声明的隔离运行时，不会获得主页面权限；密钥也不会从清单读取。
                  </span>
                </div>

                <div className="text-center text-xs text-slate-400 pt-1">
                  <span>初次制作插件？ </span>
                  <button
                    onClick={() => setActiveModalTab('spec')}
                    className="text-[#5051F9] font-bold hover:underline cursor-pointer"
                  >
                    查看《开发与打包规范说明》
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: 开发规范与示例 (完全复刻图 3 的 5 大章节) */}
            {activeModalTab === 'spec' && (
              <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-600 dark:text-slate-300 custom-scrollbar max-h-[68vh]">
                {/* 顶部醒目警示横条 */}
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Info className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>
                    以下为开发者技术规范与清单编写参考 (只读文档)。安装插件请切换至「安装插件包」。
                  </span>
                </div>

                {/* 章节 0: 概述 */}
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white mb-1.5">
                    上传统一插件包
                  </h3>
                  <p className="leading-relaxed text-slate-500 dark:text-slate-400">
                    宿主只有一种插件：一个版本化 Manifest 描述一个插件包可以向宿主贡献的全部能力。Provider、工作流、画布节点、媒体转换、素材源、Agent 和命令都可在同一个 <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 font-mono text-slate-800 dark:text-slate-200">contributes</code> 下；运行时可以不同，但不会再出现“协议插件”和“UI 插件”两套清单。
                  </p>
                </div>

                {/* 章节 1: 包格式 */}
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    1. 包格式
                  </h4>
                  <p className="leading-relaxed">
                    上传文件必须是 <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-white/10 font-mono">.yingce-plugin</code> (ZIP 包，大小不超过 48 MiB)，包内必须根目录有 <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-white/10 font-mono">manifest.json</code>；不能上传零散 JSON。清单和可选的 Web 运行时代码、静态资源属于同一个版本，权限和生命周期：
                  </p>
                  <pre className="p-3.5 rounded-xl bg-slate-900 text-slate-200 dark:bg-black/50 border border-slate-800 font-mono text-[11px] leading-relaxed overflow-x-auto">
{`my-plugin.yingce-plugin
├── manifest.json
├── web/entry.js       # 可选：必须配合 runtime.web=sandbox 或 worker
├── web/assets/...     # 可选静态资源
└── docs/...           # 可选文档`}
                  </pre>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                    后端 Provider 只使用清单中的声明式映射，不执行包内代码。UI/功能代码必须声明 <code className="font-mono">entry</code>，由宿主隔离运行时加载；不能把脚本注入主应用页面。当前版本未完成包校验、存储和入口合同，未授权的 Web 代码不会自动进入主页面。
                  </p>
                </div>

                {/* 章节 2: 最小清单 */}
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    2. 最小清单
                  </h4>
                  <p className="leading-relaxed">
                    <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-white/10 font-mono">manifest.json</code> 必须是 UTF-8 JSON。插件 ID 使用小写 kebab-case。Manifest 不得包含 Cookie、Token 或 API Key，<code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-white/10 font-mono">entry</code> 只能指向包内 <code className="font-mono">web/</code> 文件。
                  </p>
                  <pre className="p-3.5 rounded-xl bg-slate-900 text-emerald-400 dark:bg-black/50 border border-slate-800 font-mono text-[11px] leading-relaxed overflow-x-auto">
{SPEC_SAMPLE_JSON}
                  </pre>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                    带 Web 功能的插件在同一份清单中增加：
                  </p>
                  <pre className="p-3 rounded-xl bg-slate-900 text-slate-200 dark:bg-black/50 border border-slate-800 font-mono text-[11px] leading-relaxed overflow-x-auto">
{`{
  "entry": "web/entry.js",
  "surfaces": ["fullscreen"],
  "runtime": { "web": "sandbox" }
}`}
                  </pre>
                </div>

                {/* 章节 3: Contribution 规则 */}
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    3. Contribution 规则
                  </h4>
                  <ul className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                    <li>
                      <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-white/10 font-mono text-slate-800 dark:text-white">providers</code> 声明上游能力和字段映射。鉴权、Base URL、超时、私网校验、轮询、下载和计费由宿主负责。
                    </li>
                    <li>
                      <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-white/10 font-mono text-slate-800 dark:text-white">workflows</code> 声明一个 provider 下的具体工作流模型入口。AutoDL/ComfyUI 等工作流型 API 必须在这层扩展，不能为每个工作流都增加主机代码。
                    </li>
                    <li>
                      <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-white/10 font-mono text-slate-800 dark:text-white">canvasnodes</code> 声明节点 ID、默认尺寸和输入 schema。声明为 <code className="font-mono text-amber-500">declarative</code> 时使用宿主 schema renderer；<code className="font-mono text-amber-500">sandbox</code> 由隔离运行时承载。
                    </li>
                    <li>
                      <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-white/10 font-mono text-slate-800 dark:text-white">transforms</code> 声明媒体生成或转换技能，必须匹配清单权限和受控 runtime。
                    </li>
                    <li>
                      <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-white/10 font-mono text-slate-800 dark:text-white">assetSources</code>, <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-white/10 font-mono text-slate-800 dark:text-white">usageObservers</code>, <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-white/10 font-mono text-slate-800 dark:text-white">agents</code>, <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-white/10 font-mono text-slate-800 dark:text-white">commands</code> 和 <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-white/10 font-mono text-slate-800 dark:text-white">importExport</code> 处同一清单的其他贡献配置。
                    </li>
                  </ul>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                    一个插件可以同时声明多种贡献，但 ID 必须在插件包内统一，并且所有贡献共享同一个安装、仓库、权限和版本生命周期。
                  </p>
                </div>

                {/* 章节 4: Provider 与工作流 */}
                <div className="space-y-1.5">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    4. Provider 与工作流
                  </h4>
                  <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    请求字段右侧只能引用宿主统一请求，例如 <code className="font-mono text-slate-800 dark:text-slate-200">request.prompt</code>、<code className="font-mono text-slate-800 dark:text-slate-200">request.model</code>、<code className="font-mono text-slate-800 dark:text-slate-200">request.duration</code>、<code className="font-mono text-slate-800 dark:text-slate-200">request.extra</code>。声明式字段也支持安全的对象/数组路径（例如 <code className="font-mono text-slate-800 dark:text-slate-200">request.images.0.url</code>）和通用字符串转换（<code className="font-mono text-slate-800 dark:text-slate-200">|trim</code>、<code className="font-mono text-slate-800 dark:text-slate-200">|lower</code>、<code className="font-mono text-slate-800 dark:text-slate-200">|upper</code>），不执行插件代码。插件声明的枚举值由宿主充当校验，插件可使用通用大小写映射适配上游，不应要求宿主增加渠道专用代码。字板解析时会对空参数做字段丢弃，避免映射可选参数报错。Provider 如果把 <code className="font-mono text-amber-500">requiresPublicMediaUrls</code> 设为 <code className="font-mono text-amber-500">true</code>，宿主会在请求前把用户资源转换为短期签名公网 URL。响应映射支持对象路径和数组下标，并可用 <code className="font-mono text-amber-500">errorPaths</code> 声明上游错误诊断。同步 provider 只需要 <code className="font-mono">create</code> 和 <code className="font-mono">response</code>；异步 provider 再声明 <code className="font-mono">poll</code>。
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    结果 URL 如果是短期地址，必须设置 <code className="font-mono text-amber-500">resultEphemeral: true</code>，宿主会在任务完成后立即下载并保存资源，画布和任务记录只保存宿主资源引用。
                  </p>
                </div>

                {/* 章节 5: 安全与运行边界 */}
                <div className="space-y-1.5 pb-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    5. 安全与运行边界
                  </h4>
                  <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    API Key 只在渠道配置中输入和保存，不进入 Manifest、URL、日志或任务正文。
                    <br />
                    上传插件不能请求 host: 执行器，不执行任意无沙箱脚本。
                    <br />
                    外部请求必须通过宿主 provider runtime，宿主统一执行 SSRF、防重放、超时、并发、错误和计费策略。
                    <br />
                    插件声明的权限遵循最小权限；没有对应权限的 contribution 不会被激活。
                    <br />
                    上传、启用、停用和卸载操作用于同一个插件 registry record，清单校验失败时整包不会安装，不会留下半激活的 provider、节点或工作流。
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
