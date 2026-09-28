import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  RefreshCw,
  Edit2,
  Trash2,
  Copy,
  MoreHorizontal,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Eye,
  EyeOff,
  Check,
  CheckCircle2,
  X,
  Sparkles,
  HelpCircle,
  Layers,
  Activity,
  Bot,
  Globe,
  Sliders,
  AlertCircle,
  Database,
  Image as ImageIcon,
  MessageCircle,
  Video,
  Music,
  ChevronDown
} from 'lucide-react';
import {
  SystemChannel,
  ChannelModel,
  RemoteFetchedModel,
  CapabilityType,
  CustomHeader,
  TextModelParameters,
  ImageModelParameters,
  ResolutionGroup,
  AspectRatioItem
} from '../protocols/channelTypes';
import {
  getSystemChannels,
  saveSystemChannel,
  deleteSystemChannel,
  getChannelModels,
  saveChannelModel,
  deleteChannelModel,
  batchSaveChannelModels,
  fetchModelsFromChannel,
  testChannelModelConnection,
  guessModelCapabilityAndProtocol,
  getDefaultTextParameters,
  getDefaultImageParameters
} from '../protocols/channelManager';
import { ALL_PROTOCOLS, PROTOCOLS_BY_ID } from '../protocols/catalog';
import { StandardProtocolDefinition } from '../protocols/types';

interface SystemChannelSettingsProps {
  onNotify?: (msg: string) => void;
}

export const SystemChannelSettings: React.FC<SystemChannelSettingsProps> = ({ onNotify }) => {
  // Channels state
  const [channels, setChannels] = useState<SystemChannel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string>('');
  const [channelSearch, setChannelSearch] = useState('');
  const [channelStatusFilter, setChannelStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');

  // Models state
  const [models, setModels] = useState<ChannelModel[]>([]);
  const [modelSearch, setModelSearch] = useState('');
  const [modelCapabilityFilter, setModelCapabilityFilter] = useState<'all' | CapabilityType>('all');
  const [modelStatusFilter, setModelStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);

  // Modals state
  const [channelModalOpen, setChannelModalOpen] = useState(false);
  const [channelModalMode, setChannelModalMode] = useState<'create' | 'edit'>('create');
  const [editingChannel, setEditingChannel] = useState<SystemChannel | null>(null);

  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [modelModalMode, setModelModalMode] = useState<'create' | 'edit'>('create');
  const [editingModel, setEditingModel] = useState<ChannelModel | null>(null);
  const [modelModalTab, setModelModalTab] = useState<'basic' | 'params' | 'pricing'>('basic');
  const [protocolSearch, setProtocolSearch] = useState('');

  // Fetch models state
  const [fetchModalOpen, setFetchModalOpen] = useState(false);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchedRemoteModels, setFetchedRemoteModels] = useState<RemoteFetchedModel[]>([]);
  const [fetchMessage, setFetchMessage] = useState('');
  const [fetchIsFallback, setFetchIsFallback] = useState(false);

  // Testing model state
  const [testingModel, setTestingModel] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  // Password visibility
  const [showChannelApiKey, setShowChannelApiKey] = useState(false);
  const [showChannelSecretKey, setShowChannelSecretKey] = useState(false);

  // Dropdown menu state
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Protocol and capability change alert
  const [protocolChanged, setProtocolChanged] = useState(false);
  const [newRatioInput, setNewRatioInput] = useState<{ '1K': string; '2K': string; '4K': string }>({
    '1K': '',
    '2K': '',
    '4K': '',
  });
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Load channels and models
  const reloadData = () => {
    const loadedChannels = getSystemChannels();
    setChannels(loadedChannels);
    if (loadedChannels.length > 0) {
      if (!activeChannelId || !loadedChannels.some((c) => c.id === activeChannelId)) {
        setActiveChannelId(loadedChannels[0].id);
      }
    }
    const loadedModels = getChannelModels();
    setModels(loadedModels);
  };

  useEffect(() => {
    reloadData();

    const handleModelUpdate = () => {
      setModels(getChannelModels());
    };
    window.addEventListener('channel-models-updated', handleModelUpdate);
    return () => {
      window.removeEventListener('channel-models-updated', handleModelUpdate);
    };
  }, []);

  // Currently selected channel
  const currentChannel = useMemo(() => {
    return channels.find((c) => c.id === activeChannelId) || channels[0] || null;
  }, [channels, activeChannelId]);

  // Filter channels
  const filteredChannels = useMemo(() => {
    return channels.filter((c) => {
      if (channelStatusFilter === 'enabled' && !c.enabled) return false;
      if (channelStatusFilter === 'disabled' && c.enabled) return false;
      if (channelSearch.trim()) {
        const query = channelSearch.toLowerCase();
        return c.name.toLowerCase().includes(query) || c.baseUrl.toLowerCase().includes(query);
      }
      return true;
    });
  }, [channels, channelStatusFilter, channelSearch]);

  // Models under current channel
  const currentChannelModels = useMemo(() => {
    if (!currentChannel) return [];
    return models.filter((m) => m.channelId === currentChannel.id);
  }, [models, currentChannel]);

  // Filtered models
  const filteredModels = useMemo(() => {
    return currentChannelModels.filter((m) => {
      if (modelCapabilityFilter !== 'all' && m.capability !== modelCapabilityFilter) return false;
      if (modelStatusFilter === 'enabled' && !m.enabled) return false;
      if (modelStatusFilter === 'disabled' && m.enabled) return false;
      if (modelSearch.trim()) {
        const q = modelSearch.toLowerCase();
        return (
          m.modelId.toLowerCase().includes(q) ||
          m.displayName.toLowerCase().includes(q) ||
          m.upstreamModelId.toLowerCase().includes(q) ||
          (m.channelDisplayName && m.channelDisplayName.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [currentChannelModels, modelCapabilityFilter, modelStatusFilter, modelSearch]);

  // 模型列表分页状态 (默认 10 条，避免一直往下滑动)
  const [modelCurrentPage, setModelCurrentPage] = useState(1);
  const [modelPageSize, setModelPageSize] = useState(10);

  useEffect(() => {
    setModelCurrentPage(1);
  }, [activeChannelId, modelSearch, modelCapabilityFilter, modelStatusFilter]);

  const totalFilteredModelCount = filteredModels.length;
  const modelTotalPages = Math.max(1, Math.ceil(totalFilteredModelCount / modelPageSize));
  const validModelCurrentPage = Math.min(modelCurrentPage, modelTotalPages);

  const paginatedModels = useMemo(() => {
    const startIndex = (validModelCurrentPage - 1) * modelPageSize;
    return filteredModels.slice(startIndex, startIndex + modelPageSize);
  }, [filteredModels, validModelCurrentPage, modelPageSize]);

  // Handle open create channel
  const handleOpenCreateChannel = () => {
    setEditingChannel({
      id: `channel-${Date.now()}`,
      name: '',
      baseUrl: 'https://api.openai.com',
      apiKey: '',
      secretKey: '',
      customHeaders: [],
      followSystemConcurrency: true,
      maxConcurrency: 5,
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setChannelModalMode('create');
    setShowChannelApiKey(false);
    setShowChannelSecretKey(false);
    setChannelModalOpen(true);
  };

  // Handle open edit channel
  const handleOpenEditChannel = (channel: SystemChannel) => {
    setEditingChannel({ ...channel });
    setChannelModalMode('edit');
    setShowChannelApiKey(false);
    setShowChannelSecretKey(false);
    setChannelModalOpen(true);
  };

  // Handle save channel
  const handleSaveChannel = () => {
    if (!editingChannel) return;
    if (!editingChannel.name.trim()) {
      alert('请填写渠道名称');
      return;
    }
    if (!editingChannel.baseUrl.trim()) {
      alert('请填写 Base URL');
      return;
    }

    saveSystemChannel(editingChannel);
    reloadData();
    setChannelModalOpen(false);
    onNotify?.(`渠道 [${editingChannel.name}] 保存成功`);
  };

  // Handle duplicate channel
  const handleDuplicateChannel = (channel: SystemChannel) => {
    const newChannel: SystemChannel = {
      ...channel,
      id: `channel-${Date.now()}`,
      name: `${channel.name} (复制)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    saveSystemChannel(newChannel);
    // 复制原渠道模型
    const sourceModels = models.filter((m) => m.channelId === channel.id);
    const clonedModels = sourceModels.map((m) => ({
      ...m,
      id: `model-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      channelId: newChannel.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));
    batchSaveChannelModels(clonedModels);
    reloadData();
    setActiveChannelId(newChannel.id);
    onNotify?.(`已成功复制渠道 [${channel.name}]`);
  };

  // Handle delete channel
  const handleDeleteChannel = (channel: SystemChannel) => {
    if (confirm(`确定要删除渠道 [${channel.name}] 及其所有模型吗？`)) {
      deleteSystemChannel(channel.id);
      reloadData();
      onNotify?.(`已删除渠道 [${channel.name}]`);
    }
  };

  // Custom headers actions
  const handleAddHeader = () => {
    if (!editingChannel) return;
    if (editingChannel.customHeaders.length >= 32) return;
    const newHeaders = [...editingChannel.customHeaders, { id: `h-${Date.now()}`, key: '', value: '' }];
    setEditingChannel({ ...editingChannel, customHeaders: newHeaders });
  };

  const handleAddUserAgentHeader = () => {
    if (!editingChannel) return;
    const exists = editingChannel.customHeaders.some((h) => h.key.toLowerCase() === 'user-agent');
    if (exists) return;
    const newHeaders = [
      ...editingChannel.customHeaders,
      { id: `h-${Date.now()}`, key: 'User-Agent', value: 'XcAI-Studio/2.0 (+https://github.com/xiaoche0907/XcAi-ai-studio)' }
    ];
    setEditingChannel({ ...editingChannel, customHeaders: newHeaders });
  };

  const handleRemoveHeader = (id: string) => {
    if (!editingChannel) return;
    const newHeaders = editingChannel.customHeaders.filter((h) => h.id !== id);
    setEditingChannel({ ...editingChannel, customHeaders: newHeaders });
  };

  const handleUpdateHeader = (id: string, field: 'key' | 'value', val: string) => {
    if (!editingChannel) return;
    const newHeaders = editingChannel.customHeaders.map((h) => {
      if (h.id === id) return { ...h, [field]: val };
      return h;
    });
    setEditingChannel({ ...editingChannel, customHeaders: newHeaders });
  };

  // Model actions
  const handleOpenCreateModel = () => {
    if (!currentChannel) return;
    const defaultProto = guessModelCapabilityAndProtocol('chat-model', currentChannel);
    setEditingModel({
      id: `model-${Date.now()}`,
      channelId: currentChannel.id,
      modelId: '',
      upstreamModelId: '',
      displayName: '',
      channelDisplayName: '',
      logo: '',
      description: '',
      capability: 'text',
      protocolId: defaultProto.protocolId,
      rate: 'v1',
      pricing: { costPrice: '0', salePrice: '0', profitRate: '--' },
      enabled: true,
      textParams: getDefaultTextParameters(defaultProto.protocolId, ''),
      imageParams: getDefaultImageParameters(defaultProto.protocolId, ''),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setProtocolChanged(false);
    setModelModalMode('create');
    setModelModalTab('basic');
    setProtocolSearch('');
    setTestResult(null);
    setModelModalOpen(true);
  };

  const handleOpenEditModel = (model: ChannelModel) => {
    const isNew = !model.textParams && !model.imageParams;
    setEditingModel({
      ...model,
      textParams: model.textParams || getDefaultTextParameters(model.protocolId, model.modelId),
      imageParams: model.imageParams || getDefaultImageParameters(model.protocolId, model.modelId),
    });
    setProtocolChanged(isNew);
    setModelModalMode('edit');
    setModelModalTab('basic');
    setProtocolSearch('');
    setTestResult(null);
    setModelModalOpen(true);
  };

  const handleSaveModel = () => {
    if (!editingModel) return;
    if (!editingModel.modelId.trim()) {
      alert('请填写产品模型标识');
      return;
    }
    const finalModel: ChannelModel = {
      ...editingModel,
      upstreamModelId: editingModel.upstreamModelId.trim() || editingModel.modelId.trim(),
      displayName: editingModel.displayName.trim() || editingModel.modelId.trim(),
    };
    saveChannelModel(finalModel);
    reloadData();
    setModelModalOpen(false);
    onNotify?.(`模型 [${finalModel.displayName}] 保存成功`);
  };

  const handleDeleteModel = (model: ChannelModel) => {
    if (confirm(`确定删除模型 [${model.displayName || model.modelId}] 吗？`)) {
      deleteChannelModel(model.id);
      reloadData();
      onNotify?.(`已删除模型 [${model.displayName || model.modelId}]`);
    }
  };

  const handleToggleModelStatus = (model: ChannelModel) => {
    const updated = { ...model, enabled: !model.enabled };
    saveChannelModel(updated);
    reloadData();
  };

  // Handle fetch models from channel
  const handleStartFetchModels = async () => {
    if (!currentChannel) return;
    setFetchModalOpen(true);
    setIsFetchingModels(true);
    setFetchMessage('正在向上游 Base URL 请求模型元数据…');
    setFetchedRemoteModels([]);

    try {
      const res = await fetchModelsFromChannel(currentChannel);
      setFetchedRemoteModels(res.models);
      setFetchMessage(res.message);
      setFetchIsFallback(Boolean(res.isFallbackPreset));
    } catch (e: any) {
      setFetchMessage(e?.message || '拉取失败，请检查网络或配置');
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleConfirmImportFetchedModels = () => {
    if (!currentChannel) return;
    const selected = fetchedRemoteModels.filter((m) => m.selected);
    if (selected.length === 0) {
      alert('请勾选至少一个要导入的模型');
      return;
    }

    const newModels: ChannelModel[] = selected.map((item, idx) => ({
      id: `model-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
      channelId: currentChannel.id,
      modelId: item.id,
      upstreamModelId: item.id,
      displayName: item.name || item.id,
      channelDisplayName: '官方渠道',
      capability: item.capability,
      protocolId: item.recommendedProtocolId,
      rate: 'v1',
      pricing: { costPrice: '0', salePrice: '0', profitRate: '--' },
      enabled: true,
      textParams: getDefaultTextParameters(item.recommendedProtocolId, item.id),
      imageParams: getDefaultImageParameters(item.recommendedProtocolId, item.id),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));

    batchSaveChannelModels(newModels);
    reloadData();
    setFetchModalOpen(false);
    onNotify?.(`已成功导入 ${newModels.length} 个模型到 [${currentChannel.name}]`);
  };

  // Test model in modal
  const handleTestCurrentModel = async () => {
    if (!currentChannel || !editingModel) return;
    setTestingModel(true);
    setTestResult(null);

    try {
      const res = await testChannelModelConnection(currentChannel, editingModel);
      setTestResult({
        success: res.success,
        message: res.message,
      });
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e?.message || '测试失败',
      });
    } finally {
      setTestingModel(false);
    }
  };

  // Protocols filtered for the modal
  const availableProtocols = useMemo(() => {
    if (!editingModel) return [];
    return ALL_PROTOCOLS.filter((p) => {
      // capability filter
      if (editingModel.capability === 'text' && p.category !== 'text') return false;
      if (editingModel.capability === 'image' && p.category !== 'image') return false;
      if (protocolSearch.trim()) {
        const q = protocolSearch.toLowerCase();
        return (
          p.label.toLowerCase().includes(q) ||
          p.providerId.toLowerCase().includes(q) ||
          p.vendor.toLowerCase().includes(q) ||
          p.createPath.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [editingModel, protocolSearch]);

  const selectedProtocolDef = useMemo(() => {
    if (!editingModel) return null;
    return PROTOCOLS_BY_ID[editingModel.protocolId] || ALL_PROTOCOLS[0];
  }, [editingModel]);

  return (
    <div className="flex h-full w-full bg-[#F4F5F8] dark:bg-[#07090E] text-slate-800 dark:text-slate-100 font-sans overflow-hidden">
      {/* 1. 左侧：渠道管理面板 */}
      <aside className="w-80 lg:w-84 border-r border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#0E121A] flex flex-col shrink-0 overflow-hidden shadow-sm">
        {/* 顶部标题与新增渠道按钮 */}
        <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black tracking-tight text-slate-900 dark:text-white">渠道</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-xs font-bold">
              {channels.length}
            </span>
          </div>

          <button
            onClick={handleOpenCreateChannel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#5051F9] hover:bg-[#4344E0] text-white text-xs font-bold shadow-md shadow-indigo-500/20 active:scale-95 transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>新增渠道</span>
          </button>
        </div>

        {/* 搜索与状态筛选栏 */}
        <div className="p-3 border-b border-slate-100 dark:border-white/5 space-y-2 bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={channelSearch}
              onChange={(e) => setChannelSearch(e.target.value)}
              placeholder="搜索渠道名称或地址"
              className="w-full bg-white dark:bg-[#151922] border border-slate-200 dark:border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-[#5051F9] transition-all"
            />
          </div>

          <select
            value={channelStatusFilter}
            onChange={(e) => setChannelStatusFilter(e.target.value as any)}
            className="w-full bg-white dark:bg-[#151922] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-[#5051F9]"
          >
            <option value="all">全部状态</option>
            <option value="enabled">已启用</option>
            <option value="disabled">已禁用</option>
          </select>
        </div>

        {/* 渠道列表 */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredChannels.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              暂无匹配的渠道
            </div>
          ) : (
            filteredChannels.map((channel) => {
              const isSelected = currentChannel?.id === channel.id;
              const channelModelsCount = models.filter((m) => m.channelId === channel.id).length;

              return (
                <div
                  key={channel.id}
                  onClick={() => setActiveChannelId(channel.id)}
                  className={`group relative p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-blue-50/60 dark:bg-indigo-500/10 border-indigo-300 dark:border-indigo-500/40 shadow-sm'
                      : 'bg-white dark:bg-[#121620] border-slate-200/80 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/20'
                  }`}
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {channel.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                      <span>{channelModelsCount} 个模型</span>
                      <span className="flex items-center gap-1">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            channel.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                          }`}
                        />
                        <span className={channel.enabled ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}>
                          {channel.enabled ? '已启用' : '已禁用'}
                        </span>
                      </span>
                    </div>
                  </div>

                  <ChevronRight
                    className={`h-4 w-4 shrink-0 transition-transform ${
                      isSelected
                        ? 'text-indigo-600 dark:text-indigo-400 translate-x-0.5'
                        : 'text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5'
                    }`}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* 左侧底部：设置排序 */}
        <div className="p-3 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02]">
          <button
            onClick={() => onNotify?.('渠道排序功能已就绪')}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-white/5 rounded-xl border border-slate-200/80 dark:border-white/5 transition-all"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            <span>设置排序</span>
          </button>
        </div>
      </aside>

      {/* 2. 右侧：当前选中渠道详情 & 模型管理 */}
      <main className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#0A0D14]">
        {/* 顶部面包屑与说明 (图 2 原版设计) */}
        <div className="px-6 py-3.5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between shrink-0 bg-white dark:bg-[#0A0D14]">
          <div>
            <div className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
              <span>平台资源</span>
              <span>/</span>
              <span className="text-slate-800 dark:text-slate-200 font-bold">系统模型</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              左侧选择渠道，右侧直接管理模型、协议及售价。
            </p>
          </div>
        </div>

        {currentChannel ? (
          <>
            {/* 顶部渠道详情概览条 */}
            <div className="p-6 border-b border-slate-200/80 dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50 dark:bg-white/[0.01]">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-black text-slate-900 dark:text-white">
                    {currentChannel.name}
                  </h2>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                      currentChannel.enabled
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                        : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${currentChannel.enabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    <span>{currentChannel.enabled ? '已启用' : '已禁用'}</span>
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-mono">
                    <Globe className="h-3.5 w-3.5 text-slate-400" />
                    {currentChannel.baseUrl}
                  </span>
                  <span>•</span>
                  <span>{currentChannel.apiKey ? 'API Key 已配置' : '未配置 API Key'}</span>
                  <span>•</span>
                  <span>
                    最大并发: {currentChannel.followSystemConcurrency ? '跟随系统' : currentChannel.maxConcurrency}
                  </span>
                </div>
              </div>

              {/* 头部操作按钮 */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenEditChannel(currentChannel)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-bold shadow-sm transition-all"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span>编辑渠道</span>
                </button>

                <button
                  onClick={() => handleDuplicateChannel(currentChannel)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-bold shadow-sm transition-all"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>复制渠道</span>
                </button>

                <div className="relative">
                  <button
                    onClick={() => setOpenDropdownId(openDropdownId === currentChannel.id ? null : currentChannel.id)}
                    className="p-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-50 text-slate-700 dark:text-slate-200 transition-all"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>

                  {openDropdownId === currentChannel.id && (
                    <div className="absolute right-0 top-11 w-36 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A1F2C] p-1.5 shadow-xl z-30">
                      <button
                        onClick={() => {
                          setOpenDropdownId(null);
                          handleDeleteChannel(currentChannel);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>删除渠道</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 模型管理表头与筛选工具栏 */}
            <div className="p-6 pb-3 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900 dark:text-white">模型管理</h3>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-xs font-bold">
                      {currentChannelModels.length}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    规格提示成本价/销售价及利润率。勾选模型可统一调价
                  </p>
                </div>
              </div>

              {/* 工具栏：搜索 + 能力下拉 + 状态下拉 + 按钮组 */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <div className="relative min-w-[220px]">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      placeholder="搜索模型标识或显示名称"
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-[#5051F9]"
                    />
                  </div>

                  <select
                    value={modelCapabilityFilter}
                    onChange={(e) => setModelCapabilityFilter(e.target.value as any)}
                    className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-[#5051F9]"
                  >
                    <option value="all">全部能力</option>
                    <option value="text">文本</option>
                    <option value="image">图片</option>
                    <option value="video">视频</option>
                    <option value="audio">音频</option>
                  </select>

                  <select
                    value={modelStatusFilter}
                    onChange={(e) => setModelStatusFilter(e.target.value as any)}
                    className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-[#5051F9]"
                  >
                    <option value="all">全部状态</option>
                    <option value="enabled">启用</option>
                    <option value="disabled">禁用</option>
                  </select>
                </div>

                {/* 右侧动作按钮组 */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onNotify?.('模型排序设置已保存')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-bold shadow-sm transition-all"
                  >
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    <span>设置排序</span>
                  </button>

                  <button
                    onClick={handleStartFetchModels}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/70 dark:bg-indigo-500/10 hover:bg-indigo-100 text-[#5051F9] dark:text-indigo-400 text-xs font-bold shadow-sm transition-all"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>拉取模型</span>
                  </button>

                  <button
                    onClick={handleOpenCreateModel}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#5051F9] hover:bg-[#4344E0] text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition-all"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>新增模型</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 模型表格 (Table) */}
            <div className="flex-1 overflow-auto px-6">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10 text-slate-400 font-bold">
                    <th className="py-3 px-3 w-10">
                      <input
                        type="checkbox"
                        checked={
                          filteredModels.length > 0 &&
                          filteredModels.every((m) => selectedModelIds.includes(m.id))
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedModelIds(filteredModels.map((m) => m.id));
                          } else {
                            setSelectedModelIds([]);
                          }
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-0"
                      />
                    </th>
                    <th className="py-3 px-3">模型</th>
                    <th className="py-3 px-3">能力</th>
                    <th className="py-3 px-3">请求协议</th>
                    <th className="py-3 px-3">规格成本价 / 销售价 / 利润率</th>
                    <th className="py-3 px-3">费率</th>
                    <th className="py-3 px-3">状态</th>
                    <th className="py-3 px-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {filteredModels.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-slate-400 text-xs">
                        该渠道下暂无模型，点击右上角「🔄 拉取模型」或「+ 新增模型」添加
                      </td>
                    </tr>
                  ) : (
                    paginatedModels.map((model) => {
                      const protoDef = PROTOCOLS_BY_ID[model.protocolId] || ALL_PROTOCOLS[0];

                      return (
                        <tr key={model.id} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors">
                          {/* Checkbox */}
                          <td className="py-3.5 px-3">
                            <input
                              type="checkbox"
                              checked={selectedModelIds.includes(model.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedModelIds([...selectedModelIds, model.id]);
                                } else {
                                  setSelectedModelIds(selectedModelIds.filter((id) => id !== model.id));
                                }
                              }}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-0"
                            />
                          </td>

                          {/* 模型 Logo + 名称 */}
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-2.5">
                              <div className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-white/10 flex items-center justify-center shrink-0 border border-slate-200/60 dark:border-white/10 text-slate-600 dark:text-slate-300">
                                {model.capability === 'image' ? (
                                  <ImageIcon className="h-4 w-4" />
                                ) : model.capability === 'video' ? (
                                  <Video className="h-4 w-4" />
                                ) : model.capability === 'audio' ? (
                                  <Music className="h-4 w-4" />
                                ) : (
                                  <Bot className="h-4 w-4" />
                                )}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <span>{model.displayName || model.modelId}</span>
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono">
                                  {model.upstreamModelId || model.modelId}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 能力 */}
                          <td className="py-3.5 px-3">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-medium">
                              {model.capability === 'text' && '文本'}
                              {model.capability === 'image' && '图片'}
                              {model.capability === 'video' && '视频'}
                              {model.capability === 'audio' && '音频'}
                            </span>
                          </td>

                          {/* 请求协议 */}
                          <td className="py-3.5 px-3">
                            <div>
                              <div className="font-bold text-slate-800 dark:text-slate-200">
                                {protoDef?.label || model.protocolId}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                {protoDef?.createMethod || 'POST'} {protoDef?.createPath || '/v1/chat/completions'}
                              </div>
                            </div>
                          </td>

                          {/* 规格成本价 / 销售价 / 利润率 */}
                          <td className="py-3.5 px-3 text-[11px] text-slate-500 dark:text-slate-400">
                            <div>默认规格</div>
                            <div className="text-slate-700 dark:text-slate-300">实际成本价 / {model.pricing?.costPrice || '0'}</div>
                            <div>积分/次，利润率 {model.pricing?.profitRate || '--'}</div>
                          </td>

                          {/* 费率 */}
                          <td className="py-3.5 px-3">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-[11px] font-mono">
                              {model.rate || 'v1'}
                            </span>
                          </td>

                          {/* 状态 */}
                          <td className="py-3.5 px-3">
                            <button
                              onClick={() => handleToggleModelStatus(model)}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                                model.enabled
                                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                                  : 'bg-slate-100 text-slate-400 dark:bg-white/5 border border-slate-200 dark:border-white/10'
                              }`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${model.enabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                              <span>{model.enabled ? '启用' : '禁用'}</span>
                            </button>
                          </td>

                          {/* 操作 */}
                          <td className="py-3.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleOpenEditModel(model)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-50 text-slate-700 dark:text-slate-200 font-bold transition-all"
                              >
                                <Edit2 className="h-3 w-3" />
                                <span>编辑</span>
                              </button>

                              <button
                                onClick={() => handleDeleteModel(model)}
                                className="p-1.5 rounded-lg border border-red-200/60 dark:border-red-500/20 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* 表格底部条 */}
            <div className="p-4 border-t border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
              <div>
                {totalFilteredModelCount > 0 ? (
                  <span>
                    {(validModelCurrentPage - 1) * modelPageSize + 1} - {Math.min(validModelCurrentPage * modelPageSize, totalFilteredModelCount)} / 共{' '}
                    <strong className="text-slate-800 dark:text-white font-mono font-bold">{totalFilteredModelCount}</strong> 条模型
                  </span>
                ) : (
                  <span>暂无模型</span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <select
                    value={modelPageSize}
                    onChange={(e) => {
                      setModelPageSize(Number(e.target.value));
                      setModelCurrentPage(1);
                    }}
                    className="appearance-none pl-2.5 pr-6 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs text-slate-700 dark:text-slate-300 font-semibold cursor-pointer focus:outline-none"
                  >
                    <option value={5}>5 条/页</option>
                    <option value={10}>10 条/页</option>
                    <option value={20}>20 条/页</option>
                    <option value={50}>50 条/页</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setModelCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={validModelCurrentPage <= 1}
                    className="p-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition"
                    title="上一页"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  {Array.from({ length: modelTotalPages }, (_, idx) => idx + 1).map((pageNum) => {
                    if (
                      pageNum === 1 ||
                      pageNum === modelTotalPages ||
                      (pageNum >= validModelCurrentPage - 1 && pageNum <= validModelCurrentPage + 1)
                    ) {
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setModelCurrentPage(pageNum)}
                          className={`px-2.5 py-0.5 rounded-lg text-xs font-bold font-mono transition ${
                            validModelCurrentPage === pageNum
                              ? 'bg-[#5051F9] text-white shadow-sm'
                              : 'border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    }
                    if (
                      (pageNum === 2 && validModelCurrentPage > 3) ||
                      (pageNum === modelTotalPages - 1 && validModelCurrentPage < modelTotalPages - 2)
                    ) {
                      return <span key={pageNum} className="px-0.5 text-slate-400 font-mono">...</span>;
                    }
                    return null;
                  })}

                  <button
                    onClick={() => setModelCurrentPage((p) => Math.min(modelTotalPages, p + 1))}
                    disabled={validModelCurrentPage >= modelTotalPages}
                    className="p-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition"
                    title="下一页"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/30 dark:bg-white/[0.01]">
            <div className="h-16 w-16 rounded-3xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-[#5051F9] mb-4 shadow-sm border border-indigo-100 dark:border-indigo-500/20">
              <Layers className="h-8 w-8" />
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white mb-1.5">
              暂无系统渠道
            </h3>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed mb-6">
              系统当前未配置渠道。请点击左侧或下方按钮添加您的第一个云端渠道，配置 Base URL 与鉴权 Key 后即可拉取模型并绑定协议。
            </p>
            <button
              onClick={handleOpenCreateChannel}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#5051F9] hover:bg-[#4344E0] text-white text-xs font-bold shadow-md shadow-indigo-500/20 active:scale-95 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>新增系统渠道</span>
            </button>
          </div>
        )}
      </main>

      {/* 3. 弹窗一：新增/编辑系统渠道 (图 3) */}
      {channelModalOpen && editingChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto bg-white dark:bg-[#121620] rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl p-6 sm:p-7 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {channelModalMode === 'create' ? '新增系统渠道' : '编辑系统渠道'}
              </h3>
              <button
                onClick={() => setChannelModalOpen(false)}
                className="p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <div className="space-y-4 text-xs">
              {/* 渠道名称 */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">渠道名称</label>
                <input
                  type="text"
                  value={editingChannel.name}
                  onChange={(e) => setEditingChannel({ ...editingChannel, name: e.target.value })}
                  placeholder="例如: OpenAI 官方渠道"
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#5051F9]"
                />
              </div>

              {/* Base URL */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">Base URL</label>
                <input
                  type="text"
                  value={editingChannel.baseUrl}
                  onChange={(e) => setEditingChannel({ ...editingChannel, baseUrl: e.target.value })}
                  placeholder="填写云端渠道 Base URL"
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#5051F9] font-mono"
                />
              </div>

              {/* API Key / Access Key */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">API Key / Access Key</label>
                <div className="relative">
                  <input
                    type={showChannelApiKey ? 'text' : 'password'}
                    value={editingChannel.apiKey}
                    onChange={(e) => setEditingChannel({ ...editingChannel, apiKey: e.target.value })}
                    placeholder="API Key 或 Access Key"
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#5051F9] font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowChannelApiKey(!showChannelApiKey)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showChannelApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  OpenAI 兼容协议填写 API Key；即梦官方协议填写 IAM Access Key。
                </p>
              </div>

              {/* Secret Key (可选) */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">Secret Key（可选）</label>
                <div className="relative">
                  <input
                    type={showChannelSecretKey ? 'text' : 'password'}
                    value={editingChannel.secretKey || ''}
                    onChange={(e) => setEditingChannel({ ...editingChannel, secretKey: e.target.value })}
                    placeholder="IAM Secret Key"
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#5051F9] font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowChannelSecretKey(!showChannelSecretKey)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showChannelSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  仅即梦官方等 AK/SK 签名协议需要；其他渠道留空。
                </p>
              </div>

              {/* 自定义请求头 */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 dark:text-slate-200">自定义请求头</label>
                  <span className="text-[11px] text-slate-400">
                    {editingChannel.customHeaders.length}/32
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  默认发送 InfiniteCanvas/1.0 (+https://github.com/ddcat-ai/open-ai-canvas)；添加 User-Agent 后会覆盖默认值。
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddUserAgentHeader}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 transition-all text-xs"
                  >
                    添加 User-Agent
                  </button>
                  <button
                    type="button"
                    onClick={handleAddHeader}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 transition-all text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>添加请求头</span>
                  </button>
                </div>

                {editingChannel.customHeaders.length > 0 && (
                  <div className="space-y-2 pt-2">
                    {editingChannel.customHeaders.map((h) => (
                      <div key={h.id} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={h.key}
                          onChange={(e) => handleUpdateHeader(h.id, 'key', e.target.value)}
                          placeholder="Header Key (如 X-Custom-Auth)"
                          className="flex-1 bg-white dark:bg-[#151922] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200"
                        />
                        <input
                          type="text"
                          value={h.value}
                          onChange={(e) => handleUpdateHeader(h.id, 'value', e.target.value)}
                          placeholder="Header Value"
                          className="flex-1 bg-white dark:bg-[#151922] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveHeader(h.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 跟随系统并发配置 */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">跟随系统并发配置</div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setEditingChannel({
                      ...editingChannel,
                      followSystemConcurrency: !editingChannel.followSystemConcurrency,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    editingChannel.followSystemConcurrency ? 'bg-[#5051F9]' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      editingChannel.followSystemConcurrency ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* 渠道最大并发数 */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">渠道最大并发数</label>
                <input
                  type="number"
                  disabled={editingChannel.followSystemConcurrency}
                  value={editingChannel.followSystemConcurrency ? '' : editingChannel.maxConcurrency}
                  onChange={(e) =>
                    setEditingChannel({
                      ...editingChannel,
                      maxConcurrency: Number(e.target.value) || 5,
                    })
                  }
                  placeholder="使用系统..."
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 disabled:opacity-50"
                />
                <p className="text-[11px] text-slate-400">
                  后台任务和系统代理请求共享该渠道上限；槽位暂满时请求会等待。
                </p>
              </div>

              {/* 启用 Toggle */}
              <div className="flex items-center justify-between pt-2">
                <div className="font-bold text-slate-800 dark:text-slate-200">启用</div>
                <button
                  type="button"
                  onClick={() =>
                    setEditingChannel({
                      ...editingChannel,
                      enabled: !editingChannel.enabled,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    editingChannel.enabled ? 'bg-[#5051F9]' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      editingChannel.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/10">
              <button
                type="button"
                onClick={() => setChannelModalOpen(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 text-xs transition-all"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveChannel}
                className="px-6 py-2.5 rounded-xl bg-[#5051F9] hover:bg-[#4344E0] text-white font-bold text-xs shadow-md shadow-indigo-500/25 transition-all"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. 弹窗二：编辑/新增模型 (图 4) */}
      {modelModalOpen && editingModel && currentChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-4xl max-h-[94vh] flex flex-col bg-white dark:bg-[#121620] rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-6 pb-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {modelModalMode === 'create' ? '新增模型' : '编辑模型'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {currentChannel.name} • {editingModel.displayName || editingModel.modelId || '新模型'}
                </p>
              </div>
              <button
                onClick={() => setModelModalOpen(false)}
                className="p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="px-6 border-b border-slate-100 dark:border-white/10 flex items-center gap-6 shrink-0 text-xs font-bold">
              <button
                onClick={() => setModelModalTab('basic')}
                className={`py-3 border-b-2 transition-all ${
                  modelModalTab === 'basic'
                    ? 'border-[#5051F9] text-[#5051F9]'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                基本信息
              </button>
              <button
                onClick={() => setModelModalTab('params')}
                className={`py-3 border-b-2 transition-all ${
                  modelModalTab === 'params'
                    ? 'border-[#5051F9] text-[#5051F9]'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                能力与参数
              </button>
              <button
                onClick={() => setModelModalTab('pricing')}
                className={`py-3 border-b-2 transition-all ${
                  modelModalTab === 'pricing'
                    ? 'border-[#5051F9] text-[#5051F9]'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                积分定价
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              {modelModalTab === 'basic' && (
                <>
                  {/* 模型身份 */}
                  <div className="p-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] space-y-4">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>模型身份</span>
                        <span className="text-slate-400 font-normal text-[11px]">区分产品侧展示标识与上游实际调用 ID。</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* 产品模型标识 */}
                      <div className="space-y-1.5">
                        <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <span className="text-red-500">*</span>
                          <span>产品模型标识</span>
                          <HelpCircle className="h-3 w-3 text-slate-400" />
                        </label>
                        <input
                          type="text"
                          value={editingModel.modelId}
                          onChange={(e) => setEditingModel({ ...editingModel, modelId: e.target.value })}
                          placeholder="如: deepseek-flash"
                          className="w-full bg-white dark:bg-[#151922] border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#5051F9]"
                        />
                      </div>

                      {/* 上游模型 ID */}
                      <div className="space-y-1.5">
                        <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <span>上游模型 ID</span>
                          <HelpCircle className="h-3 w-3 text-slate-400" />
                        </label>
                        <input
                          type="text"
                          value={editingModel.upstreamModelId}
                          onChange={(e) => setEditingModel({ ...editingModel, upstreamModelId: e.target.value })}
                          placeholder="如: deepseek-chat"
                          className="w-full bg-white dark:bg-[#151922] border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#5051F9]"
                        />
                      </div>

                      {/* 模型展示名 (一级目录) */}
                      <div className="space-y-1.5">
                        <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <span>模型展示名（一级目录）</span>
                          <HelpCircle className="h-3 w-3 text-slate-400" />
                        </label>
                        <input
                          type="text"
                          value={editingModel.displayName}
                          onChange={(e) => setEditingModel({ ...editingModel, displayName: e.target.value })}
                          placeholder="如: deepseek-flash"
                          className="w-full bg-white dark:bg-[#151922] border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#5051F9]"
                        />
                      </div>

                      {/* 渠道展示名 (二级目录) */}
                      <div className="space-y-1.5">
                        <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <span>渠道展示名（二级目录）</span>
                          <HelpCircle className="h-3 w-3 text-slate-400" />
                        </label>
                        <input
                          type="text"
                          value={editingModel.channelDisplayName || ''}
                          onChange={(e) => setEditingModel({ ...editingModel, channelDisplayName: e.target.value })}
                          placeholder="例如: 正常渠道、优惠渠道-993、特惠渠道-730"
                          className="w-full bg-white dark:bg-[#151922] border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#5051F9]"
                        />
                      </div>
                    </div>

                    {/* 模型描述 */}
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700 dark:text-slate-300">模型描述</label>
                      <textarea
                        rows={2}
                        value={editingModel.description || ''}
                        onChange={(e) => setEditingModel({ ...editingModel, description: e.target.value.slice(0, 500) })}
                        placeholder="填写此渠道模型的使用说明"
                        className="w-full bg-white dark:bg-[#151922] border border-slate-200 dark:border-white/10 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#5051F9]"
                      />
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>在创作端二级渠道选项悬浮或聚焦时显示，可说明适用场景、渠道差异和注意事项。</span>
                        <span>{(editingModel.description || '').length}/500</span>
                      </div>
                    </div>
                  </div>

                  {/* 能力与协议 */}
                  <div className="p-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] space-y-4">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>能力与协议</span>
                        <span className="text-slate-400 font-normal text-[11px]">先选择任务类型，再选择对应的调用协议；更换后请核对参数与价格。</span>
                      </div>
                    </div>

                    {/* 模型能力单选按钮组 */}
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <span className="text-red-500">*</span>
                        <span>模型能力</span>
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {(['text', 'image', 'video', 'audio'] as CapabilityType[]).map((cap) => {
                          const isActive = editingModel.capability === cap;
                          return (
                            <button
                              key={cap}
                              type="button"
                              onClick={() => {
                                const newProto = guessModelCapabilityAndProtocol(editingModel.modelId || 'test', {
                                  ...currentChannel,
                                  name: cap === 'image' ? 'image' : currentChannel.name,
                                });
                                setEditingModel({
                                  ...editingModel,
                                  capability: cap,
                                  protocolId: newProto.protocolId,
                                  textParams: getDefaultTextParameters(newProto.protocolId, editingModel.modelId),
                                  imageParams: getDefaultImageParameters(newProto.protocolId, editingModel.modelId),
                                });
                                setProtocolChanged(true);
                              }}
                              className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                                isActive
                                  ? 'bg-[#5051F9] text-white border-[#5051F9] shadow-sm'
                                  : 'bg-white dark:bg-[#151922] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                              }`}
                            >
                              {cap === 'text' && '文本'}
                              {cap === 'image' && '图片'}
                              {cap === 'video' && '视频'}
                              {cap === 'audio' && '音频'}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 调用协议选择 */}
                    <div className="space-y-2">
                      <label className="font-bold text-slate-700 dark:text-slate-300">调用协议</label>

                      {/* 搜索框 */}
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          value={protocolSearch}
                          onChange={(e) => setProtocolSearch(e.target.value)}
                          placeholder="搜索协议名称、厂商或请求路径"
                          className="w-full bg-white dark:bg-[#151922] border border-slate-200 dark:border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#5051F9]"
                        />
                      </div>

                      {/* 双列联动布局：左侧协议列表，右侧协议详情 */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 border border-slate-200 dark:border-white/10 rounded-2xl bg-white dark:bg-[#151922] overflow-hidden">
                        {/* 左侧协议卡片列表 (可滚动) */}
                        <div className="md:col-span-7 max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5 p-2">
                          {availableProtocols.map((p) => {
                            const isSelected = editingModel.protocolId === p.providerId;

                            return (
                              <div
                                key={p.providerId}
                                onClick={() => {
                                  setEditingModel({
                                    ...editingModel,
                                    protocolId: p.providerId,
                                    textParams: getDefaultTextParameters(p.providerId, editingModel.modelId),
                                    imageParams: getDefaultImageParameters(p.providerId, editingModel.modelId),
                                  });
                                  setProtocolChanged(true);
                                }}
                                className={`p-3 rounded-xl cursor-pointer flex items-center justify-between transition-all ${
                                  isSelected
                                    ? 'bg-blue-50/80 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30'
                                    : 'hover:bg-slate-50 dark:hover:bg-white/5 border border-transparent'
                                }`}
                              >
                                <div className="min-w-0 pr-2">
                                  <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                                    <span>{p.label}</span>
                                    {p.hasAgent && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                        Agent 就绪
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                    {p.createMethod} {p.createPath}
                                  </div>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                                    {p.vendor} / 影策
                                  </div>
                                </div>

                                <div className="shrink-0">
                                  <div
                                    className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                                      isSelected
                                        ? 'border-[#5051F9] bg-[#5051F9] text-white'
                                        : 'border-slate-300 dark:border-slate-600'
                                    }`}
                                  >
                                    {isSelected && <Check className="h-2.5 w-2.5" />}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* 右侧选中的协议详细信息预览 */}
                        <div className="md:col-span-5 bg-slate-50/80 dark:bg-white/[0.03] p-4 border-t md:border-t-0 md:border-l border-slate-200 dark:border-white/10 flex flex-col justify-between">
                          {selectedProtocolDef ? (
                            <div className="space-y-3">
                              <span className="text-[10px] uppercase font-bold text-slate-400">当前选择</span>
                              <div className="text-sm font-black text-slate-900 dark:text-white">
                                {selectedProtocolDef.label}
                              </div>

                              <div className="space-y-2 text-[11px] text-slate-600 dark:text-slate-300">
                                <div className="flex items-start gap-2">
                                  <span className="text-slate-400 shrink-0">请求:</span>
                                  <span className="font-mono text-slate-800 dark:text-slate-200">
                                    {selectedProtocolDef.createMethod} {selectedProtocolDef.createPath}
                                  </span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="text-slate-400 shrink-0">请求体:</span>
                                  <span className="font-mono">{selectedProtocolDef.contentType || 'application/json'}</span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="text-slate-400 shrink-0">响应:</span>
                                  <span>{selectedProtocolDef.hasPoll ? '异步轮询任务' : '同步响应 / 流式响应'}</span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="text-slate-400 shrink-0">来源:</span>
                                  <span>{selectedProtocolDef.vendor} / 影策 • {selectedProtocolDef.version}</span>
                                </div>
                              </div>

                              {selectedProtocolDef.description && (
                                <div className="pt-2 text-[11px] text-slate-400 border-t border-slate-200/60 dark:border-white/5">
                                  {selectedProtocolDef.description}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-slate-400 text-xs">请在左侧选择调用协议</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {modelModalTab === 'params' && (
                <div className="space-y-5 animate-in fade-in">
                  {/* 顶部黄色提醒横幅 */}
                  {protocolChanged && (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-200">
                      <div className="h-5 w-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-black shrink-0 mt-0.5 shadow-sm">
                        !
                      </div>
                      <div>
                        <div className="font-bold text-amber-900 dark:text-amber-100 mb-0.5">能力或协议已变更</div>
                        <div className="text-[11px] leading-relaxed text-amber-700/90 dark:text-amber-300/90">
                          引用与参数已恢复为新协议默认值，旧规格条件已在切换能力时清除。价格与计费方式保留，请在保存前核对。
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 1. 文本模型专属能力与参数 (图 1) */}
                  {editingModel.capability === 'text' && (
                    <div className="space-y-5">
                      {/* 引用与限制 */}
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-black text-xs text-slate-900 dark:text-white">引用与限制</h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">按媒体类型纵向配置数量、大小、时长及通用约束。</p>
                        </div>

                        {/* 上下文能力 */}
                        <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#151922] space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-bold text-xs text-slate-800 dark:text-slate-200">上下文能力</div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                这是上游文本模型的能力合同，决定 Agent 本轮可保留的输入预算；不会改变运行时 checkpoint 的持久化上限。
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setCollapsedSections(prev => ({ ...prev, contextCapacity: !prev.contextCapacity }))}
                              className="text-slate-400 hover:text-slate-600"
                            >
                              <ChevronDown className={`h-4 w-4 transform transition-transform ${collapsedSections.contextCapacity ? '-rotate-90' : ''}`} />
                            </button>
                          </div>

                          {!collapsedSections.contextCapacity && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                              <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">上下文窗口 Token</label>
                                <input
                                  type="number"
                                  value={editingModel.textParams?.contextWindowTokens ?? 128000}
                                  onChange={(e) =>
                                    setEditingModel({
                                      ...editingModel,
                                      textParams: {
                                        ...(editingModel.textParams || getDefaultTextParameters(editingModel.protocolId, editingModel.modelId)),
                                        contextWindowTokens: Number(e.target.value) || 0,
                                      },
                                    })
                                  }
                                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#5051F9]"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">最大输出 Token</label>
                                <input
                                  type="number"
                                  value={editingModel.textParams?.maxOutputTokens ?? 16384}
                                  onChange={(e) =>
                                    setEditingModel({
                                      ...editingModel,
                                      textParams: {
                                        ...(editingModel.textParams || getDefaultTextParameters(editingModel.protocolId, editingModel.modelId)),
                                        maxOutputTokens: Number(e.target.value) || 0,
                                      },
                                    })
                                  }
                                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#5051F9]"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 三栏卡片：图片引用 / 视频引用 / 通用限制 */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* 图片引用 */}
                          <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#151922] space-y-3">
                            <div>
                              <div className="font-bold text-xs text-slate-800 dark:text-slate-200">图片引用</div>
                              <div className="text-[11px] text-slate-400 mt-0.5">文本模型可接收的图片范围</div>
                            </div>

                            <div className="space-y-3">
                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">最大参考图片数</label>
                                <input
                                  type="number"
                                  value={editingModel.textParams?.maxReferenceImages ?? 0}
                                  onChange={(e) =>
                                    setEditingModel({
                                      ...editingModel,
                                      textParams: {
                                        ...(editingModel.textParams || getDefaultTextParameters(editingModel.protocolId, editingModel.modelId)),
                                        maxReferenceImages: Number(e.target.value) || 0,
                                      },
                                    })
                                  }
                                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">单张图片上限 MB</label>
                                <input
                                  type="number"
                                  value={editingModel.textParams?.maxImageSizeMb ?? 0}
                                  onChange={(e) =>
                                    setEditingModel({
                                      ...editingModel,
                                      textParams: {
                                        ...(editingModel.textParams || getDefaultTextParameters(editingModel.protocolId, editingModel.modelId)),
                                        maxImageSizeMb: Number(e.target.value) || 0,
                                      },
                                    })
                                  }
                                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono"
                                />
                              </div>
                            </div>
                          </div>

                          {/* 视频引用 */}
                          <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#151922] space-y-3">
                            <div>
                              <div className="font-bold text-xs text-slate-800 dark:text-slate-200">视频引用</div>
                              <div className="text-[11px] text-slate-400 mt-0.5">文本模型可接收的视频范围</div>
                            </div>

                            <div className="space-y-3">
                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">最大参考视频数</label>
                                <input
                                  type="number"
                                  value={editingModel.textParams?.maxReferenceVideos ?? 0}
                                  onChange={(e) =>
                                    setEditingModel({
                                      ...editingModel,
                                      textParams: {
                                        ...(editingModel.textParams || getDefaultTextParameters(editingModel.protocolId, editingModel.modelId)),
                                        maxReferenceVideos: Number(e.target.value) || 0,
                                      },
                                    })
                                  }
                                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">单个视频上限 MB</label>
                                <input
                                  type="number"
                                  value={editingModel.textParams?.maxVideoSizeMb ?? 0}
                                  onChange={(e) =>
                                    setEditingModel({
                                      ...editingModel,
                                      textParams: {
                                        ...(editingModel.textParams || getDefaultTextParameters(editingModel.protocolId, editingModel.modelId)),
                                        maxVideoSizeMb: Number(e.target.value) || 0,
                                      },
                                    })
                                  }
                                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono"
                                />
                              </div>
                            </div>
                          </div>

                          {/* 通用限制 */}
                          <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#151922] space-y-3">
                            <div>
                              <div className="font-bold text-xs text-slate-800 dark:text-slate-200">通用限制</div>
                              <div className="text-[11px] text-slate-400 mt-0.5">所有文本请求共用的基础约束</div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">提示词最大字符数</label>
                              <input
                                type="number"
                                value={editingModel.textParams?.maxPromptLength ?? 32000}
                                onChange={(e) =>
                                  setEditingModel({
                                    ...editingModel,
                                    textParams: {
                                      ...(editingModel.textParams || getDefaultTextParameters(editingModel.protocolId, editingModel.modelId)),
                                      maxPromptLength: Number(e.target.value) || 32000,
                                    },
                                  })
                                }
                                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 协议参数 */}
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-black text-xs text-slate-900 dark:text-white">协议参数</h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">配置可发送参数、支持值与默认值；仅影响当前模型。</p>
                        </div>

                        {/* 输出方式 */}
                        <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#151922] space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-bold text-xs text-slate-800 dark:text-slate-200">输出方式</div>
                              <div className="text-[11px] text-slate-400 mt-0.5">控制向上游文本模型请求的响应方式。</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setCollapsedSections(prev => ({ ...prev, outputMode: !prev.outputMode }))}
                              className="text-slate-400 hover:text-slate-600"
                            >
                              <ChevronDown className={`h-4 w-4 transform transition-transform ${collapsedSections.outputMode ? '-rotate-90' : ''}`} />
                            </button>
                          </div>

                          {!collapsedSections.outputMode && (
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5">
                              <div>
                                <div className="font-bold text-xs text-slate-800 dark:text-slate-200">SSE 流式输出</div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  启用后发送 stream=true，并实时推送文本增量；关闭时等待完整 JSON 响应。
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-slate-400">支持</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const current = editingModel.textParams?.enableSseStream ?? true;
                                    setEditingModel({
                                      ...editingModel,
                                      textParams: {
                                        ...(editingModel.textParams || getDefaultTextParameters(editingModel.protocolId, editingModel.modelId)),
                                        enableSseStream: !current,
                                      },
                                    });
                                  }}
                                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                    (editingModel.textParams?.enableSseStream ?? true) ? 'bg-[#5051F9]' : 'bg-slate-300 dark:bg-slate-700'
                                  }`}
                                >
                                  <span
                                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                      (editingModel.textParams?.enableSseStream ?? true) ? 'translate-x-4' : 'translate-x-1'
                                    }`}
                                  />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2. 图像模型专属能力与参数 (图 2) */}
                  {editingModel.capability === 'image' && (
                    <div className="space-y-5">
                      {/* 引用与限制 */}
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-black text-xs text-slate-900 dark:text-white">引用与限制</h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">按媒体类型纵向配置数量、大小、时长及通用约束。</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* 图片引用 */}
                          <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#151922] space-y-3">
                            <div>
                              <div className="font-bold text-xs text-slate-800 dark:text-slate-200">图片引用</div>
                              <div className="text-[11px] text-slate-400 mt-0.5">参考图、文件大小与蒙版能力</div>
                            </div>

                            <div className="space-y-2.5">
                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">最大参考图</label>
                                <input
                                  type="number"
                                  value={editingModel.imageParams?.maxReferenceImages ?? 16}
                                  onChange={(e) =>
                                    setEditingModel({
                                      ...editingModel,
                                      imageParams: {
                                        ...(editingModel.imageParams || getDefaultImageParameters(editingModel.protocolId, editingModel.modelId)),
                                        maxReferenceImages: Number(e.target.value) || 0,
                                      },
                                    })
                                  }
                                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">单图上限 MB</label>
                                <input
                                  type="number"
                                  value={editingModel.imageParams?.maxImageSizeMb ?? 30}
                                  onChange={(e) =>
                                    setEditingModel({
                                      ...editingModel,
                                      imageParams: {
                                        ...(editingModel.imageParams || getDefaultImageParameters(editingModel.protocolId, editingModel.modelId)),
                                        maxImageSizeMb: Number(e.target.value) || 0,
                                      },
                                    })
                                  }
                                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono"
                                />
                              </div>

                              <div className="flex items-center justify-between pt-1">
                                <div>
                                  <div className="font-bold text-xs text-slate-800 dark:text-slate-200">蒙版编辑</div>
                                  <div className="text-[11px] text-slate-400">允许图片编辑接口提交 mask</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-slate-400">支持</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const cur = editingModel.imageParams?.supportMaskEdit ?? true;
                                      setEditingModel({
                                        ...editingModel,
                                        imageParams: {
                                          ...(editingModel.imageParams || getDefaultImageParameters(editingModel.protocolId, editingModel.modelId)),
                                          supportMaskEdit: !cur,
                                        },
                                      });
                                    }}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                      (editingModel.imageParams?.supportMaskEdit ?? true) ? 'bg-[#5051F9]' : 'bg-slate-300 dark:bg-slate-700'
                                    }`}
                                  >
                                    <span
                                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                        (editingModel.imageParams?.supportMaskEdit ?? true) ? 'translate-x-4' : 'translate-x-1'
                                      }`}
                                    />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* 通用限制 */}
                          <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#151922] space-y-3">
                            <div>
                              <div className="font-bold text-xs text-slate-800 dark:text-slate-200">通用限制</div>
                              <div className="text-[11px] text-slate-400 mt-0.5">所有图片请求共用的基础约束</div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">提示词最大字符数</label>
                              <input
                                type="number"
                                value={editingModel.imageParams?.maxPromptLength ?? 32000}
                                onChange={(e) =>
                                  setEditingModel({
                                    ...editingModel,
                                    imageParams: {
                                      ...(editingModel.imageParams || getDefaultImageParameters(editingModel.protocolId, editingModel.modelId)),
                                      maxPromptLength: Number(e.target.value) || 32000,
                                    },
                                  })
                                }
                                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 协议参数 */}
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-black text-xs text-slate-900 dark:text-white">协议参数</h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">配置可发送参数、支持值与默认值；仅影响当前模型。</p>
                        </div>

                        {/* 01 尺寸参数 */}
                        <div className="p-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#151922] space-y-4">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 font-mono text-[10px] font-bold">
                                01
                              </span>
                              <span className="font-bold text-xs text-slate-900 dark:text-white">尺寸参数</span>
                              <span className="text-[11px] text-slate-400">按分辨率配置可选规格，直接点击或输入比例</span>
                            </div>

                            {/* 模式按键组 */}
                            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 text-xs font-bold shrink-0">
                              {(['none', 'size', 'aspect_ratio'] as const).map((mode) => {
                                const isCur = (editingModel.imageParams?.dimensionMode ?? 'size') === mode;
                                return (
                                  <button
                                    key={mode}
                                    type="button"
                                    onClick={() =>
                                      setEditingModel({
                                        ...editingModel,
                                        imageParams: {
                                          ...(editingModel.imageParams || getDefaultImageParameters(editingModel.protocolId, editingModel.modelId)),
                                          dimensionMode: mode,
                                        },
                                      })
                                    }
                                    className={`px-3 py-1 rounded-lg transition-all ${
                                      isCur
                                        ? 'bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                                    }`}
                                  >
                                    {mode === 'none' && '不发送'}
                                    {mode === 'size' && 'size'}
                                    {mode === 'aspect_ratio' && 'aspect_ratio'}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="text-[11px] text-slate-400 leading-relaxed">
                            按分辨率配置支持的比例，尺寸自动换算。size 发送像素，aspect_ratio 发送比例；独立分辨率由模型协议适配。实际输出尺寸以上游为准。
                            <br />
                            点击支持该比例。再次点击可移除。尺寸自动换算，已有抽画尺寸便携不变。
                          </div>

                          {/* 1K / 2K / 4K 分辨率组列表 */}
                          <div className="space-y-3 pt-1">
                            {(editingModel.imageParams?.resolutions || getDefaultImageParameters(editingModel.protocolId, editingModel.modelId).resolutions).map((resGroup, groupIdx) => (
                              <div key={resGroup.name} className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01]">
                                <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                                  {/* 左侧控制区: 分辨率名称、比例数、启用开关 */}
                                  <div className="w-16 shrink-0 flex flex-col items-start gap-1 pt-1">
                                    <span className="font-black text-xs text-slate-800 dark:text-slate-200">{resGroup.name}</span>
                                    <span className="text-[11px] text-slate-400">
                                      {resGroup.ratios.filter(r => r.enabled).length} 个比例
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nextResolutions = [...(editingModel.imageParams?.resolutions || getDefaultImageParameters(editingModel.protocolId, editingModel.modelId).resolutions)];
                                        nextResolutions[groupIdx].enabled = !nextResolutions[groupIdx].enabled;
                                        setEditingModel({
                                          ...editingModel,
                                          imageParams: {
                                            ...(editingModel.imageParams || getDefaultImageParameters(editingModel.protocolId, editingModel.modelId)),
                                            resolutions: nextResolutions,
                                          },
                                        });
                                      }}
                                      className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors mt-0.5 ${
                                        resGroup.enabled ? 'bg-slate-900 dark:bg-white' : 'bg-slate-300 dark:bg-slate-700'
                                      }`}
                                    >
                                      <span
                                        className={`inline-block h-3 w-3 transform rounded-full bg-white dark:bg-slate-900 transition-transform ${
                                          resGroup.enabled ? 'translate-x-3.5' : 'translate-x-0.5'
                                        }`}
                                      />
                                    </button>
                                  </div>

                                  {/* 右侧比例卡片与添加自定义比例 */}
                                  {resGroup.enabled && (
                                    <div className="flex-1 min-w-0 space-y-2">
                                      <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-1.5">
                                        {resGroup.ratios.map((item, rIdx) => (
                                          <button
                                            key={item.ratio}
                                            type="button"
                                            onClick={() => {
                                              const nextResolutions = [...(editingModel.imageParams?.resolutions || getDefaultImageParameters(editingModel.protocolId, editingModel.modelId).resolutions)];
                                              nextResolutions[groupIdx].ratios[rIdx].enabled = !nextResolutions[groupIdx].ratios[rIdx].enabled;
                                              setEditingModel({
                                                ...editingModel,
                                                imageParams: {
                                                  ...(editingModel.imageParams || getDefaultImageParameters(editingModel.protocolId, editingModel.modelId)),
                                                  resolutions: nextResolutions,
                                                },
                                              });
                                            }}
                                            className={`flex flex-col justify-between p-2 rounded-xl border text-left transition-all ${
                                              item.enabled
                                                ? 'bg-slate-100/90 dark:bg-white/10 border-slate-300 dark:border-white/20 text-slate-900 dark:text-white font-medium'
                                                : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400 opacity-50'
                                            }`}
                                          >
                                            <div className="flex items-center justify-between w-full">
                                              <span className="text-xs font-bold">{item.ratio}</span>
                                              {item.enabled && <Check className="h-3 w-3 text-slate-600 dark:text-slate-300 shrink-0 ml-1" />}
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-mono mt-1 whitespace-nowrap">{item.resolution}</span>
                                          </button>
                                        ))}
                                      </div>

                                      {/* 添加自定义比例行 */}
                                      <div className="flex items-center gap-2 pt-1">
                                        <input
                                          type="text"
                                          value={newRatioInput[resGroup.name] || ''}
                                          onChange={(e) => setNewRatioInput({ ...newRatioInput, [resGroup.name]: e.target.value })}
                                          placeholder="其他比例，如 17:11"
                                          className="bg-white dark:bg-[#151922] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono w-48 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-[#5051F9]"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const val = (newRatioInput[resGroup.name] || '').trim();
                                            if (!val) return;
                                            const nextResolutions = [...(editingModel.imageParams?.resolutions || getDefaultImageParameters(editingModel.protocolId, editingModel.modelId).resolutions)];
                                            nextResolutions[groupIdx].ratios.push({
                                              ratio: val,
                                              resolution: `${val} 换算`,
                                              enabled: true,
                                            });
                                            setEditingModel({
                                              ...editingModel,
                                              imageParams: {
                                                ...(editingModel.imageParams || getDefaultImageParameters(editingModel.protocolId, editingModel.modelId)),
                                                resolutions: nextResolutions,
                                              },
                                            });
                                            setNewRatioInput({ ...newRatioInput, [resGroup.name]: '' });
                                          }}
                                          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-white/10 transition-all"
                                        >
                                          + 添加
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* 默认输出与允许自定义 */}
                          <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-white/5">
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                默认输出 <span className="font-normal text-slate-400">用户选择模型时的初始尺寸</span>
                              </label>
                              <div className="flex flex-wrap gap-1.5">
                                {[
                                  '自动', '1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '21:9', '9:16',
                                  '1K · 1:1', '1K · 4:3', '1K · 3:4', '1K · 3:2', '1K · 2:3', '1K · 4:5', '1K · 5:4', '1K · 21:9', '1K · 16:9', '1K · 9:16',
                                  '2K · 1:1', '2K · 4:3', '2K · 3:4', '2K · 3:2', '2K · 2:3', '2K · 4:5', '2K · 5:4', '2K · 21:9', '2K · 16:9', '2K · 9:16',
                                  '4K · 1:1', '4K · 4:3', '4K · 3:4', '4K · 3:2', '4K · 2:3', '4K · 4:5', '4K · 5:4', '4K · 21:9', '4K · 16:9', '4K · 9:16',
                                ].map((dim) => {
                                  const isSelected = (editingModel.imageParams?.defaultOutputDimension || '自动') === dim;
                                  return (
                                    <button
                                      key={dim}
                                      type="button"
                                      onClick={() =>
                                        setEditingModel({
                                          ...editingModel,
                                          imageParams: {
                                            ...(editingModel.imageParams || getDefaultImageParameters(editingModel.protocolId, editingModel.modelId)),
                                            defaultOutputDimension: dim,
                                          },
                                        })
                                      }
                                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                                        isSelected
                                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-sm'
                                          : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                                      }`}
                                    >
                                      {dim}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                              <div>
                                <div className="font-bold text-xs text-slate-800 dark:text-slate-200">允许自定义</div>
                                <div className="text-[11px] text-slate-400">允许支持值之外的尺寸</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-slate-400">支持</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const cur = editingModel.imageParams?.allowCustomDimension ?? true;
                                    setEditingModel({
                                      ...editingModel,
                                      imageParams: {
                                        ...(editingModel.imageParams || getDefaultImageParameters(editingModel.protocolId, editingModel.modelId)),
                                        allowCustomDimension: !cur,
                                      },
                                    });
                                  }}
                                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                    (editingModel.imageParams?.allowCustomDimension ?? true) ? 'bg-[#5051F9]' : 'bg-slate-300 dark:bg-slate-700'
                                  }`}
                                >
                                  <span
                                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                      (editingModel.imageParams?.allowCustomDimension ?? true) ? 'translate-x-4' : 'translate-x-1'
                                    }`}
                                  />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 02 与 03 横向分栏 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* 02 输出数量 */}
                          <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#151922] space-y-3">
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 font-mono text-[10px] font-bold">
                                02
                              </span>
                              <span className="font-bold text-xs text-slate-900 dark:text-white">输出数量</span>
                              <span className="text-[11px] text-slate-400">设置单次生成图片数量</span>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">单次生成张数</label>
                              <input
                                type="number"
                                value={editingModel.imageParams?.batchCount ?? 15}
                                onChange={(e) =>
                                  setEditingModel({
                                    ...editingModel,
                                    imageParams: {
                                      ...(editingModel.imageParams || getDefaultImageParameters(editingModel.protocolId, editingModel.modelId)),
                                      batchCount: Number(e.target.value) || 1,
                                    },
                                  })
                                }
                                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono"
                              />
                            </div>
                          </div>

                          {/* 03 可选参数 */}
                          <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#151922] space-y-3">
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 font-mono text-[10px] font-bold">
                                03
                              </span>
                              <span className="font-bold text-xs text-slate-900 dark:text-white">可选参数</span>
                              <span className="text-[11px] text-slate-400">控制质量、背景与响应格式</span>
                            </div>

                            <div className="space-y-3 pt-1 text-xs">
                              {/* 图片质量 */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">图片质量</span>
                                    <span className="text-[11px] text-slate-400 ml-1.5">发送 quality 参数</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-slate-400">支持</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const cur = editingModel.imageParams?.quality.enabled ?? true;
                                        setEditingModel({
                                          ...editingModel,
                                          imageParams: {
                                            ...(editingModel.imageParams || getDefaultImageParameters(editingModel.protocolId, editingModel.modelId)),
                                            quality: {
                                              ...(editingModel.imageParams?.quality || { supportedValues: ['auto', 'low', 'medium', 'high'], defaultValue: 'auto' }),
                                              enabled: !cur,
                                            },
                                          },
                                        });
                                      }}
                                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                        (editingModel.imageParams?.quality.enabled ?? true) ? 'bg-[#5051F9]' : 'bg-slate-300 dark:bg-slate-700'
                                      }`}
                                    >
                                      <span
                                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                          (editingModel.imageParams?.quality.enabled ?? true) ? 'translate-x-4' : 'translate-x-1'
                                        }`}
                                      />
                                    </button>
                                  </div>
                                </div>

                                {/* 质量支持值 tags */}
                                <div className="space-y-1">
                                  <label className="text-[11px] text-slate-400">质量支持值</label>
                                  <div className="flex flex-wrap gap-1.5 p-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
                                    {(editingModel.imageParams?.quality.supportedValues || ['auto', 'low', 'medium', 'high']).map((qVal) => (
                                      <span key={qVal} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-[11px]">
                                        <span>{qVal}</span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const vals = (editingModel.imageParams?.quality.supportedValues || ['auto', 'low', 'medium', 'high']).filter(v => v !== qVal);
                                            setEditingModel({
                                              ...editingModel,
                                              imageParams: {
                                                ...(editingModel.imageParams || getDefaultImageParameters(editingModel.protocolId, editingModel.modelId)),
                                                quality: {
                                                  ...(editingModel.imageParams?.quality || { defaultValue: 'auto', enabled: true }),
                                                  supportedValues: vals,
                                                },
                                              },
                                            });
                                          }}
                                          className="text-slate-400 hover:text-red-500"
                                        >
                                          ×
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                </div>

                                {/* 默认质量 */}
                                <div className="space-y-1">
                                  <label className="text-[11px] text-slate-400">默认质量</label>
                                  <select
                                    value={editingModel.imageParams?.quality.defaultValue || 'auto'}
                                    onChange={(e) =>
                                      setEditingModel({
                                        ...editingModel,
                                        imageParams: {
                                          ...(editingModel.imageParams || getDefaultImageParameters(editingModel.protocolId, editingModel.modelId)),
                                          quality: {
                                            ...(editingModel.imageParams?.quality || { supportedValues: ['auto', 'low', 'medium', 'high'], enabled: true }),
                                            defaultValue: e.target.value,
                                          },
                                        },
                                      })
                                    }
                                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300"
                                  >
                                    <option value="auto">auto</option>
                                    <option value="low">low</option>
                                    <option value="medium">medium</option>
                                    <option value="high">high</option>
                                  </select>
                                </div>
                              </div>

                              {/* 透光背景 */}
                              <div className="flex items-center justify-between pt-1">
                                <div>
                                  <div className="font-bold text-slate-800 dark:text-slate-200">透光背景</div>
                                  <div className="text-[11px] text-slate-400">可发送参数与默认值</div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] text-slate-400">支持</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const cur = editingModel.imageParams?.transparentBackground.enabled ?? true;
                                        setEditingModel({
                                          ...editingModel,
                                          imageParams: {
                                            ...(editingModel.imageParams || getDefaultImageParameters(editingModel.protocolId, editingModel.modelId)),
                                            transparentBackground: {
                                              ...(editingModel.imageParams?.transparentBackground || { defaultValue: false }),
                                              enabled: !cur,
                                            },
                                          },
                                        });
                                      }}
                                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                        (editingModel.imageParams?.transparentBackground.enabled ?? true) ? 'bg-[#5051F9]' : 'bg-slate-300 dark:bg-slate-700'
                                      }`}
                                    >
                                      <span
                                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                          (editingModel.imageParams?.transparentBackground.enabled ?? true) ? 'translate-x-4' : 'translate-x-1'
                                        }`}
                                      />
                                    </button>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] text-slate-400">默认</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const cur = editingModel.imageParams?.transparentBackground.defaultValue ?? false;
                                        setEditingModel({
                                          ...editingModel,
                                          imageParams: {
                                            ...(editingModel.imageParams || getDefaultImageParameters(editingModel.protocolId, editingModel.modelId)),
                                            transparentBackground: {
                                              ...(editingModel.imageParams?.transparentBackground || { enabled: true }),
                                              defaultValue: !cur,
                                            },
                                          },
                                        });
                                      }}
                                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                        (editingModel.imageParams?.transparentBackground.defaultValue ?? false) ? 'bg-[#5051F9]' : 'bg-slate-300 dark:bg-slate-700'
                                      }`}
                                    >
                                      <span
                                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                          (editingModel.imageParams?.transparentBackground.defaultValue ?? false) ? 'translate-x-4' : 'translate-x-1'
                                        }`}
                                      />
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* response_format */}
                              <div className="flex items-center justify-between pt-1">
                                <div>
                                  <div className="font-bold text-slate-800 dark:text-slate-200">response_format</div>
                                  <div className="text-[11px] text-slate-400">发送 b64_json 响应格式</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-slate-400">支持</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const cur = editingModel.imageParams?.responseFormatB64 ?? true;
                                      setEditingModel({
                                        ...editingModel,
                                        imageParams: {
                                          ...(editingModel.imageParams || getDefaultImageParameters(editingModel.protocolId, editingModel.modelId)),
                                          responseFormatB64: !cur,
                                        },
                                      });
                                    }}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                      (editingModel.imageParams?.responseFormatB64 ?? true) ? 'bg-[#5051F9]' : 'bg-slate-300 dark:bg-slate-700'
                                    }`}
                                  >
                                    <span
                                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                        (editingModel.imageParams?.responseFormatB64 ?? true) ? 'translate-x-4' : 'translate-x-1'
                                      }`}
                                    />
                                  </button>
                                </div>
                              </div>

                              {/* output_format */}
                              <div className="flex items-center justify-between pt-1">
                                <div>
                                  <div className="font-bold text-slate-800 dark:text-slate-200">output_format</div>
                                  <div className="text-[11px] text-slate-400">发送 PNG 输出格式</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-slate-400">支持</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const cur = editingModel.imageParams?.outputFormatPng ?? true;
                                      setEditingModel({
                                        ...editingModel,
                                        imageParams: {
                                          ...(editingModel.imageParams || getDefaultImageParameters(editingModel.protocolId, editingModel.modelId)),
                                          outputFormatPng: !cur,
                                        },
                                      });
                                    }}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                      (editingModel.imageParams?.outputFormatPng ?? true) ? 'bg-[#5051F9]' : 'bg-slate-300 dark:bg-slate-700'
                                    }`}
                                  >
                                    <span
                                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                        (editingModel.imageParams?.outputFormatPng ?? true) ? 'translate-x-4' : 'translate-x-1'
                                      }`}
                                    />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 其它任务类型 (视频 / 音频) 通用参数 */}
                  {editingModel.capability !== 'text' && editingModel.capability !== 'image' && (
                    <div className="p-6 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] space-y-4">
                      <div className="font-bold text-slate-900 dark:text-white">高级能力与调用参数</div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="font-bold text-slate-700 dark:text-slate-300">费率版本</label>
                          <input
                            type="text"
                            value={editingModel.rate || 'v1'}
                            onChange={(e) => setEditingModel({ ...editingModel, rate: e.target.value })}
                            placeholder="例如: v1, v2"
                            className="w-full bg-white dark:bg-[#151922] border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {modelModalTab === 'pricing' && (
                <div className="p-6 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] space-y-4">
                  <div className="font-bold text-slate-900 dark:text-white">计费与积分规格配置</div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700 dark:text-slate-300">成本价 (点/次)</label>
                      <input
                        type="text"
                        value={editingModel.pricing?.costPrice || '0'}
                        onChange={(e) =>
                          setEditingModel({
                            ...editingModel,
                            pricing: { ...editingModel.pricing, costPrice: e.target.value },
                          })
                        }
                        className="w-full bg-white dark:bg-[#151922] border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700 dark:text-slate-300">销售价 (点/次)</label>
                      <input
                        type="text"
                        value={editingModel.pricing?.salePrice || '0'}
                        onChange={(e) =>
                          setEditingModel({
                            ...editingModel,
                            pricing: { ...editingModel.pricing, salePrice: e.target.value },
                          })
                        }
                        className="w-full bg-white dark:bg-[#151922] border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700 dark:text-slate-300">利润率</label>
                      <input
                        type="text"
                        value={editingModel.pricing?.profitRate || '--'}
                        onChange={(e) =>
                          setEditingModel({
                            ...editingModel,
                            pricing: { ...editingModel.pricing, profitRate: e.target.value },
                          })
                        }
                        className="w-full bg-white dark:bg-[#151922] border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 px-6 border-t border-slate-100 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 bg-slate-50/50 dark:bg-white/[0.01]">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingModel({ ...editingModel, enabled: !editingModel.enabled })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      editingModel.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        editingModel.enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">模型启用</span>
                  <span className="text-[11px] text-slate-400">保存后生效</span>
                </div>

                {testResult && (
                  <span
                    className={`text-xs font-bold ml-2 ${
                      testResult.success ? 'text-emerald-500' : 'text-red-500'
                    }`}
                  >
                    {testResult.message}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={testingModel}
                  onClick={handleTestCurrentModel}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 text-xs transition-all disabled:opacity-50"
                >
                  {testingModel ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Activity className="h-3.5 w-3.5" />
                  )}
                  <span>{testingModel ? '正在测试…' : '测试模型'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModelModalOpen(false)}
                  className="px-5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 text-xs transition-all"
                >
                  取消
                </button>

                <button
                  type="button"
                  onClick={handleSaveModel}
                  className="px-6 py-2 rounded-xl bg-[#5051F9] hover:bg-[#4344E0] text-white font-bold text-xs shadow-md shadow-indigo-500/25 transition-all"
                >
                  保存修改
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. 弹窗三：从上游渠道拉取模型 (Fetch Models Modal) */}
      {fetchModalOpen && currentChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-white dark:bg-[#121620] rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-6 pb-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <RefreshCw className={`h-4 w-4 text-[#5051F9] ${isFetchingModels ? 'animate-spin' : ''}`} />
                  <span>拉取上游模型列表</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  渠道: <span className="font-bold text-slate-700 dark:text-slate-300">{currentChannel.name}</span> ({currentChannel.baseUrl})
                </p>
              </div>
              <button
                onClick={() => setFetchModalOpen(false)}
                className="p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Fetch Message Banner */}
            {fetchMessage && (
              <div
                className={`mx-6 mt-4 p-3.5 rounded-2xl text-xs flex items-center gap-2.5 ${
                  fetchIsFallback
                    ? 'bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400'
                    : 'bg-indigo-500/10 border border-indigo-500/20 text-[#5051F9] dark:text-indigo-400'
                }`}
              >
                <Sparkles className="h-4 w-4 shrink-0" />
                <span>{fetchMessage}</span>
              </div>
            )}

            {/* Models Selection List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-2">
              {isFetchingModels ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400 text-xs">
                  <RefreshCw className="h-6 w-6 animate-spin text-[#5051F9]" />
                  <span>正在连接渠道上游接口解析模型清单…</span>
                </div>
              ) : fetchedRemoteModels.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs">
                  未能获取到模型，请检查 Base URL 和 API Key。
                </div>
              ) : (
                fetchedRemoteModels.map((item, index) => {
                  const protoDef = PROTOCOLS_BY_ID[item.recommendedProtocolId];

                  return (
                    <div
                      key={item.id + index}
                      onClick={() => {
                        const updated = [...fetchedRemoteModels];
                        updated[index].selected = !updated[index].selected;
                        setFetchedRemoteModels(updated);
                      }}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        item.selected
                          ? 'bg-indigo-50/60 dark:bg-indigo-500/10 border-indigo-300 dark:border-indigo-500/30'
                          : 'bg-white dark:bg-[#151922] border-slate-200 dark:border-white/5 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <input
                          type="checkbox"
                          checked={Boolean(item.selected)}
                          onChange={() => {}} // handled by parent div
                          className="rounded border-slate-300 text-indigo-600 focus:ring-0"
                        />
                        <div>
                          <div className="font-bold text-xs text-slate-900 dark:text-white font-mono">
                            {item.id}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>推荐协议: {protoDef?.label || item.recommendedProtocolId}</span>
                            <span>•</span>
                            <span>能力: {item.capability}</span>
                          </div>
                        </div>
                      </div>

                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 font-bold shrink-0">
                        {item.capability === 'text' ? '文本对话' : '图像生成'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-4 px-6 border-t border-slate-100 dark:border-white/10 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-white/[0.01]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const allSelected = fetchedRemoteModels.every((m) => m.selected);
                    setFetchedRemoteModels(
                      fetchedRemoteModels.map((m) => ({ ...m, selected: !allSelected }))
                    );
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 font-bold text-xs"
                >
                  {fetchedRemoteModels.every((m) => m.selected) ? '全不选' : '全选'}
                </button>
                <span className="text-xs text-slate-400">
                  已选 {fetchedRemoteModels.filter((m) => m.selected).length} / {fetchedRemoteModels.length}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFetchModalOpen(false)}
                  className="px-5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 text-xs transition-all"
                >
                  取消
                </button>

                <button
                  type="button"
                  disabled={fetchedRemoteModels.filter((m) => m.selected).length === 0}
                  onClick={handleConfirmImportFetchedModels}
                  className="px-6 py-2 rounded-xl bg-[#5051F9] hover:bg-[#4344E0] text-white font-bold text-xs shadow-md shadow-indigo-500/25 transition-all disabled:opacity-50"
                >
                  确认导入已选模型
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
