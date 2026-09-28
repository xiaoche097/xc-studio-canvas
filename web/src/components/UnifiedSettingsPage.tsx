import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Save,
  Bot,
  Cpu,
  Shield,
  Zap,
  Globe,
  Key,
  RefreshCw,
  Cloud,
  Eye,
  EyeOff,
  Check,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  MessageCircle,
  Trash2,
  CheckCircle2,
  Copy,
  HelpCircle,
  HardDrive,
  Database,
  Image as ImageIcon,
  Search,
  Filter,
  ExternalLink,
  Code,
  Layers,
  Sliders,
  ChevronDown,
  ChevronRight,
  Activity,
  Terminal,
  Server,
  Workflow,
  LayoutDashboard,
  Users,
  ShieldCheck,
  Plug
} from 'lucide-react';
import { ALL_PROTOCOLS, TEXT_PROTOCOLS, IMAGE_PROTOCOLS, PROTOCOLS_BY_ID } from '../protocols/catalog';
import { StandardProtocolDefinition, UserProtocolConfig, ProtocolCategory } from '../protocols/types';
import { SystemChannelSettings } from './SystemChannelSettings';
import { StorageServiceSettings } from './StorageServiceSettings';
import { ImageHostServiceSettings } from './ImageHostServiceSettings';
import { DataOverviewDashboard } from './DataOverviewDashboard';
import { UserManagementPage } from './UserManagementPage';
import { PluginManagementPage } from './PluginManagementPage';
import { PromptTemplateManagementPage } from './PromptTemplateManagementPage';
import {
  getUserProtocolConfigs,
  saveUserProtocolConfig,
  saveAllUserProtocolConfigs,
  getActiveProtocol,
  setActiveProtocol,
  testProtocolConnection
} from '../protocols/protocolManager';
import {
  getTextModelPowerMode,
  setTextModelPowerMode,
} from '../modules/Cyzx4/utils/apiHelpers';
import { storageService, CacheStats } from '../services/storageService';
import { DEFAULT_DEEPSEEK_BASE_URL, DEEPSEEK_SERVER_MANAGED } from '../modules/Cyzx4/services/provider-config';
import { testDeepSeekConnection } from '../modules/Cyzx4/services/agents/runtime/deepseek-adapter';
import {
  DEEPSEEK_AUTO_MODEL,
} from '../modules/Cyzx4/services/deepseek-model-router';
import {
  findVirseWorkspace,
  getVirseAccount,
  getVirseRawToolData,
  getVirseWorkspaceDiagnostic,
  listVirseImageModels,
  listVirseWorkspaces,
  VirseImageModel,
  VirseWorkspace,
} from '../services/virseService';

const DEFAULT_VIRSE_BASE_URL = 'https://api.virse.ai';
const VIRSE_DEV_BASE_URL = 'https://dev.virse.ai';

export type UnifiedSettingsTab =
  | 'overview'
  | 'users'
  | 'protocols'
  | 'plugins'
  | 'prompts'
  | 'virse'
  | 'relays'
  | 'cache'
  | 'image-host'
  | 'storage';

interface UnifiedSettingsPageProps {
  onBack: () => void;
  initialTab?: UnifiedSettingsTab;
}

export const UnifiedSettingsPage: React.FC<UnifiedSettingsPageProps> = ({
  onBack,
  initialTab = 'overview',
}) => {
  const [activeTab, setActiveTab] = useState<UnifiedSettingsTab>(initialTab);

  // Protocols state
  const [protocolConfigs, setProtocolConfigs] = useState<Record<string, UserProtocolConfig>>({});
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'text' | 'image' | 'agent' | 'configured'>('all');
  const [selectedVendor, setSelectedVendor] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [detailProtocol, setDetailProtocol] = useState<StandardProtocolDefinition | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [testStates, setTestStates] = useState<Record<string, { loading: boolean; success?: boolean; message?: string; latency?: number }>>({});
  const [defaultTextId, setDefaultTextId] = useState<string>('deepseek-chat');
  const [defaultImageId, setDefaultImageId] = useState<string>('gemini-image');

  // Agent Settings State
  const [agentName, setAgentName] = useState('XcAI 首席电商视觉策划师');
  const [agentRole, setAgentRole] = useState('你是一个拥有10年经验的亚马逊/独立站电商视觉总监。你的目标是根据用户提供的产品信息或图片，策划出高转化率的视觉方案。');
  const [agentCapabilities, setAgentCapabilities] = useState('1. 深入分析产品卖点与目标市场\n2. 策划高转化率的电商图片（主图、副图、A+）\n3. 保持专业、精炼的语言风格');
  const [deepThinkingEnabled, setDeepThinkingEnabled] = useState(false);
  const [textApiProvider, setTextApiProvider] = useState<'auto' | 'deepseek' | 'plato' | 'yunwu' | 'runninghub' | 'native'>('auto');

  // Relay Settings State (Quick Relays)
  const [nativeApiKey, setNativeApiKey] = useState('');
  const [isNativeKeyVisible, setIsNativeKeyVisible] = useState(false);
  const [nativeEnabled, setNativeEnabled] = useState(true);

  const [deepSeekApiKey, setDeepSeekApiKey] = useState('');
  const [deepSeekBaseUrl, setDeepSeekBaseUrl] = useState(DEFAULT_DEEPSEEK_BASE_URL);
  const [deepSeekReasoning, setDeepSeekReasoning] = useState<'off' | 'low' | 'high' | 'max'>('high');
  const [isDeepSeekKeyVisible, setIsDeepSeekKeyVisible] = useState(false);
  const [deepSeekEnabled, setDeepSeekEnabled] = useState(false);
  const [deepSeekTestStatus, setDeepSeekTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [deepSeekTestMessage, setDeepSeekTestMessage] = useState('');

  const [yunwuApiKey, setYunwuApiKey] = useState('');
  const [yunwuBaseUrl, setYunwuBaseUrl] = useState('https://yunwu.ai');
  const [yunwuEnabled, setYunwuEnabled] = useState(true);

  const [platoApiKey, setPlatoApiKey] = useState('');
  const [platoBaseUrl, setPlatoBaseUrl] = useState('https://api.apilio.ai');
  const [platoEnabled, setPlatoEnabled] = useState(false);

  const [volcengineApiKey, setVolcengineApiKey] = useState('');
  const [volcengineEnabled, setVolcengineEnabled] = useState(false);

  // Virse MCP State
  const [virseApiKey, setVirseApiKey] = useState('');
  const [virseBaseUrl, setVirseBaseUrl] = useState(DEFAULT_VIRSE_BASE_URL);
  const [isVirseKeyVisible, setIsVirseKeyVisible] = useState(false);
  const [virseEnabled, setVirseEnabled] = useState(false);
  const [virseWorkspaces, setVirseWorkspaces] = useState<VirseWorkspace[]>([]);
  const [virseModels, setVirseModels] = useState<VirseImageModel[]>([]);
  const [virseCanvasId, setVirseCanvasId] = useState('');
  const [virseSpaceId, setVirseSpaceId] = useState('');
  const [virseModel, setVirseModel] = useState('nano-banana-2');
  const [virseTestStatus, setVirseTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [virseTestMessage, setVirseTestMessage] = useState('');
  const [virseDiagnostic, setVirseDiagnostic] = useState('');
  const [virseDiagnosticLoading, setVirseDiagnosticLoading] = useState(false);
  const virseSyncVersion = useRef(0);

  // Cache & Storage
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [cacheBusy, setCacheBusy] = useState(false);
  const [cacheMessage, setCacheMessage] = useState('');

  // Image Hosting
  const [imageHostProvider, setImageHostProvider] = useState<'none' | 'imgbb' | 'freeimage'>('imgbb');
  const [imgbbApiKey, setImgbbApiKey] = useState('');
  const [isImgbbKeyVisible, setIsImgbbKeyVisible] = useState(false);
  const [freeimageApiKey, setFreeimageApiKey] = useState('');
  const [isFreeimageKeyVisible, setIsFreeimageKeyVisible] = useState(false);
  const [imageHostTestStatus, setImageHostTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [imageHostTestMessage, setImageHostTestMessage] = useState('');



  // Global save toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Load initial settings on mount
  useEffect(() => {
    // 1. Load protocols config
    const configs = getUserProtocolConfigs();
    setProtocolConfigs(configs);

    const activeText = getActiveProtocol('text');
    if (activeText) setDefaultTextId(activeText.protocol.providerId);

    const activeImage = getActiveProtocol('image');
    if (activeImage) setDefaultImageId(activeImage.protocol.providerId);

    // 2. Load Agent settings
    const savedName = localStorage.getItem('agentName');
    const savedRole = localStorage.getItem('agentRole');
    const savedCaps = localStorage.getItem('agentCapabilities');
    const savedTextApiProvider = localStorage.getItem('text_api_provider');
    if (savedName) setAgentName(savedName);
    if (savedRole) setAgentRole(savedRole);
    if (savedCaps) setAgentCapabilities(savedCaps);
    if (savedTextApiProvider === 'deepseek' || savedTextApiProvider === 'plato' || savedTextApiProvider === 'yunwu' || savedTextApiProvider === 'runninghub' || savedTextApiProvider === 'native') {
      setTextApiProvider(savedTextApiProvider);
    } else {
      setTextApiProvider('auto');
    }
    setDeepThinkingEnabled(getTextModelPowerMode() === 'deep-thinking');

    // 3. Load Relay settings
    const savedNativeKey = localStorage.getItem('user_api_key');
    const savedNativeEnabled = localStorage.getItem('native_enabled');
    if (savedNativeKey) setNativeApiKey(savedNativeKey);
    if (savedNativeEnabled !== null) setNativeEnabled(savedNativeEnabled !== 'false');

    const savedDeepSeekKey = localStorage.getItem('deepseek_api_key');
    const savedDeepSeekBase = localStorage.getItem('deepseek_base_url');
    const savedDeepSeekEnabled = localStorage.getItem('deepseek_enabled');
    if (savedDeepSeekKey) setDeepSeekApiKey(savedDeepSeekKey);
    if (savedDeepSeekBase) setDeepSeekBaseUrl(savedDeepSeekBase);
    if (savedDeepSeekEnabled !== null) setDeepSeekEnabled(savedDeepSeekEnabled === 'true');

    const savedYunwuKey = localStorage.getItem('yunwu_api_key');
    const savedYunwuBase = localStorage.getItem('yunwu_base_url');
    const savedYunwuEnabled = localStorage.getItem('yunwu_enabled');
    if (savedYunwuKey) setYunwuApiKey(savedYunwuKey);
    if (savedYunwuBase) setYunwuBaseUrl(savedYunwuBase);
    if (savedYunwuEnabled !== null) setYunwuEnabled(savedYunwuEnabled !== 'false');

    const savedPlatoKey = localStorage.getItem('plato_api_key');
    const savedPlatoBase = localStorage.getItem('plato_base_url');
    const savedPlatoEnabled = localStorage.getItem('plato_enabled');
    if (savedPlatoKey) setPlatoApiKey(savedPlatoKey);
    if (savedPlatoBase) setPlatoBaseUrl(savedPlatoBase);
    if (savedPlatoEnabled !== null) setPlatoEnabled(savedPlatoEnabled === 'true');

    const savedVolcengineKey = localStorage.getItem('volcengine_api_key');
    const savedVolcengineEnabled = localStorage.getItem('seedance_enabled');
    if (savedVolcengineKey) setVolcengineApiKey(savedVolcengineKey);
    if (savedVolcengineEnabled !== null) setVolcengineEnabled(savedVolcengineEnabled === 'true');

    // Virse
    const savedVirseKey = localStorage.getItem('virse_api_key');
    const savedVirseBase = localStorage.getItem('virse_base_url');
    const savedVirseEnabled = localStorage.getItem('virse_enabled');
    const savedVirseSpace = localStorage.getItem('virse_space_id');
    const savedVirseCanvas = localStorage.getItem('virse_canvas_id');
    const savedVirseModel = localStorage.getItem('virse_model');
    if (savedVirseKey) setVirseApiKey(savedVirseKey);
    if (savedVirseBase) setVirseBaseUrl(savedVirseBase);
    if (savedVirseEnabled !== null) setVirseEnabled(savedVirseEnabled !== 'false');
    if (savedVirseSpace) setVirseSpaceId(savedVirseSpace);
    if (savedVirseCanvas) setVirseCanvasId(savedVirseCanvas);
    if (savedVirseModel) setVirseModel(savedVirseModel);

    const cachedVirseModels = localStorage.getItem('virse_image_models_cache');
    if (cachedVirseModels) {
      try { setVirseModels(JSON.parse(cachedVirseModels)); } catch {}
    }

    // 4. Cache
    loadCacheStats();

    // 5. Image Hosting
    const savedImageHost = localStorage.getItem('image_host_provider');
    const savedImgbbKey = localStorage.getItem('imgbb_api_key');
    const savedFreeimageKey = localStorage.getItem('freeimage_api_key');
    if (savedImageHost === 'none' || savedImageHost === 'imgbb' || savedImageHost === 'freeimage') {
      setImageHostProvider(savedImageHost);
    }
    if (savedImgbbKey) setImgbbApiKey(savedImgbbKey);
    if (savedFreeimageKey) setFreeimageApiKey(savedFreeimageKey);
  }, []);

  useEffect(() => {
    virseSyncVersion.current += 1;
    const key = virseApiKey.trim();
    if (!key || !virseEnabled) return;
    const version = virseSyncVersion.current;

    Promise.all([
      listVirseWorkspaces(key, virseBaseUrl),
      listVirseImageModels(key, virseBaseUrl).catch(() => null),
    ]).then(([workspaces, models]) => {
      if (version !== virseSyncVersion.current) return;
      if (workspaces && workspaces.length > 0) setVirseWorkspaces(workspaces);
      if (models && models.length > 0) {
        setVirseModels(models);
        localStorage.setItem('virse_image_models_cache', JSON.stringify(models));
      }
    }).catch(() => {});
  }, [virseApiKey, virseBaseUrl, virseEnabled]);

  const loadCacheStats = async () => {
    try {
      const stats = await storageService.getCacheStats();
      setCacheStats(stats);
    } catch (e) {
      console.error(e);
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '0 MB';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  const handleClearCache = async (type: 'images' | 'videos' | 'expired' | 'all') => {
    setCacheBusy(true);
    setCacheMessage('正在清理缓存...');
    try {
      if (type === 'all') {
        await storageService.clearAllCache();
      } else if (type === 'expired') {
        await storageService.cleanupExpiredCache();
      } else {
        await storageService.clearCacheByType(type);
      }
      await loadCacheStats();
      setCacheMessage('清理完成');
      setTimeout(() => setCacheMessage(''), 2000);
    } catch (err: any) {
      setCacheMessage(`清理失败: ${err?.message || '未知错误'}`);
    } finally {
      setCacheBusy(false);
    }
  };

  // Vendor list for filtering
  const allVendors = useMemo(() => {
    const set = new Set<string>();
    ALL_PROTOCOLS.forEach((p) => set.add(p.vendor));
    return Array.from(set).sort();
  }, []);

  // Filtered protocols list
  const filteredProtocols = useMemo(() => {
    return ALL_PROTOCOLS.filter((protocol) => {
      // Category filter
      if (selectedCategory === 'text' && protocol.category !== 'text') return false;
      if (selectedCategory === 'image' && protocol.category !== 'image') return false;
      if (selectedCategory === 'agent' && !protocol.hasAgent) return false;
      if (selectedCategory === 'configured') {
        const conf = protocolConfigs[protocol.providerId];
        if (!conf || (!conf.enabled && !conf.apiKey)) return false;
      }

      // Vendor filter
      if (selectedVendor !== 'all' && protocol.vendor !== selectedVendor) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchLabel = protocol.label.toLowerCase().includes(q);
        const matchId = protocol.providerId.toLowerCase().includes(q);
        const matchPlugin = protocol.pluginId.toLowerCase().includes(q);
        const matchDesc = protocol.description.toLowerCase().includes(q);
        const matchVendor = protocol.vendor.toLowerCase().includes(q);
        const matchEndpoint = (protocol.createPath || '').toLowerCase().includes(q);
        if (!matchLabel && !matchId && !matchPlugin && !matchDesc && !matchVendor && !matchEndpoint) {
          return false;
        }
      }

      return true;
    });
  }, [selectedCategory, selectedVendor, searchQuery, protocolConfigs]);

  // Protocol config update
  const handleUpdateProtocolConfig = (providerId: string, updates: Partial<UserProtocolConfig>) => {
    const updated = {
      ...protocolConfigs,
      [providerId]: {
        ...(protocolConfigs[providerId] || {
          providerId,
          enabled: false,
          baseUrl: PROTOCOLS_BY_ID[providerId]?.baseUrl || '',
          apiKey: '',
          defaultModel: PROTOCOLS_BY_ID[providerId]?.recommendedModels?.[0] || '',
        }),
        ...updates,
      },
    };
    setProtocolConfigs(updated);
    saveUserProtocolConfig(providerId, updated[providerId]);
  };

  // Test protocol connection
  const handleTestProtocol = async (protocol: StandardProtocolDefinition) => {
    const currentConfig = protocolConfigs[protocol.providerId] || {
      providerId: protocol.providerId,
      enabled: true,
      baseUrl: protocol.baseUrl,
      apiKey: '',
      defaultModel: protocol.recommendedModels?.[0] || '',
    };

    setTestStates((prev) => ({
      ...prev,
      [protocol.providerId]: { loading: true, message: '正在测试上游连接...' },
    }));

    try {
      const res = await testProtocolConnection(protocol, currentConfig);
      setTestStates((prev) => ({
        ...prev,
        [protocol.providerId]: {
          loading: false,
          success: res.success,
          message: res.message,
          latency: res.latencyMs,
        },
      }));

      // Update in stored config
      handleUpdateProtocolConfig(protocol.providerId, {
        lastTestedAt: Date.now(),
        testStatus: res.success ? 'success' : 'error',
        testMessage: res.message,
        latencyMs: res.latencyMs,
      });
    } catch (err: any) {
      setTestStates((prev) => ({
        ...prev,
        [protocol.providerId]: {
          loading: false,
          success: false,
          message: `连接异常: ${err?.message || '未知错误'}`,
        },
      }));
    }
  };

  // Set default protocol
  const handleSetDefault = (category: ProtocolCategory, providerId: string) => {
    setActiveProtocol(category, providerId);
    if (category === 'text') setDefaultTextId(providerId);
    if (category === 'image') setDefaultImageId(providerId);
    showToast(`已将 ${PROTOCOLS_BY_ID[providerId]?.label || providerId} 设为默认${category === 'text' ? '文本对话' : '图像生成'}协议`);
  };

  // Test DeepSeek relay directly
  // Test DeepSeek relay directly
  const handleTestDeepSeekRelay = async () => {
    const key = deepSeekApiKey.split(/[,\n]/).map((item) => item.trim()).find(Boolean);
    setDeepSeekTestStatus('testing');
    setDeepSeekTestMessage('正在连接 DeepSeek 原生 API...');
    try {
      const response = await testDeepSeekConnection({
        baseUrl: deepSeekBaseUrl.trim() || DEFAULT_DEEPSEEK_BASE_URL,
        apiKey: key || '',
      });
      setDeepSeekTestStatus('success');
      setDeepSeekTestMessage(response ? `连接成功: ${response}` : '连接成功');
    } catch (error: unknown) {
      setDeepSeekTestStatus('error');
      setDeepSeekTestMessage(`连接失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // Test Virse MCP
  const handleTestVirse = async () => {
    const key = virseApiKey.trim();
    if (!key) {
      setVirseTestStatus('error');
      setVirseTestMessage('请输入 Virse API Key');
      return;
    }

    setVirseTestStatus('testing');
    setVirseTestMessage('正在连接 Virse 并同步工作区…');
    virseSyncVersion.current += 1;
    const syncVersion = virseSyncVersion.current;
    setVirseDiagnostic('');
    try {
      const activeBaseUrl = virseBaseUrl;
      const [account, workspaces, models] = await Promise.all([
        getVirseAccount(key, activeBaseUrl),
        listVirseWorkspaces(key, activeBaseUrl),
        listVirseImageModels(key, activeBaseUrl),
      ]);
      if (syncVersion !== virseSyncVersion.current) return;
      if (workspaces.length === 0 && models.length === 0) {
        const [rawWorkspaces, rawModels] = await Promise.all([
          getVirseRawToolData(key, activeBaseUrl, 'list_workspaces'),
          getVirseRawToolData(key, activeBaseUrl, 'list_image_models'),
        ]);
        if (syncVersion !== virseSyncVersion.current) return;
        setVirseDiagnostic(JSON.stringify({
          endpoint: activeBaseUrl,
          list_workspaces: rawWorkspaces,
          list_image_models: rawModels,
        }, null, 2));
      }
      setVirseWorkspaces(workspaces);
      setVirseModels(models);
      localStorage.setItem('virse_image_models_cache', JSON.stringify(models));

      if (workspaces.length === 0) {
        setVirseSpaceId('');
        setVirseCanvasId('');
        localStorage.removeItem('virse_space_id');
        localStorage.removeItem('virse_canvas_id');
        window.dispatchEvent(new Event('api-settings-updated'));
        throw new Error('Virse 未返回可用工作区/画布，请确认 API Key、账号权限和 API 节点。');
      }

      const currentWorkspace = findVirseWorkspace(workspaces, virseSpaceId, virseCanvasId);
      const nextSpaceId = currentWorkspace?.space_id || '';
      const nextCanvasId = currentWorkspace?.canvas_id || '';
      setVirseSpaceId(nextSpaceId);
      setVirseCanvasId(nextCanvasId);
      const nextModel = models.length > 0 && !models.some((model) => model.id === virseModel)
        ? models[0].id
        : virseModel;
      if (models.length > 0 && !models.some((model) => model.id === virseModel)) {
        setVirseModel(nextModel);
      }

      localStorage.setItem('virse_api_key', key);
      localStorage.setItem('virse_base_url', activeBaseUrl);
      localStorage.setItem('virse_enabled', String(virseEnabled));
      localStorage.setItem('virse_space_id', nextSpaceId);
      localStorage.setItem('virse_canvas_id', nextCanvasId);
      localStorage.setItem('virse_model', nextModel);
      window.dispatchEvent(new Event('api-settings-updated'));

      const displayName = account?.name || account?.username || account?.user?.name || account?.email || '账户已验证';
      const balance = account?.balance ?? account?.organization?.balance;
      const details = [
        activeBaseUrl.includes('dev.') ? 'Dev 节点' : 'API 节点',
        String(displayName),
        `${workspaces.length} 个工作区`,
        `${models.length} 个图片模型`,
        balance !== undefined ? `余额 ${balance} CU` : '',
      ].filter(Boolean).join(' · ');
      setVirseTestStatus('success');
      setVirseTestMessage(`${details}${currentWorkspace ? '' : virseCanvasId ? ' · 原画布已失效，请重新选择' : ' · 请选择目标画布'}`);
    } catch (e: any) {
      if (syncVersion !== virseSyncVersion.current) return;
      setVirseWorkspaces([]);
      setVirseModels([]);
      setVirseTestStatus('error');
      setVirseTestMessage(e?.message || 'Virse 连接失败');
    }
  };

  // Save all settings to localStorage
  const handleSaveAll = () => {
    // 1. Protocols
    saveAllUserProtocolConfigs(protocolConfigs);

    // 2. Agent
    localStorage.setItem('agentName', agentName);
    localStorage.setItem('agentRole', agentRole);
    localStorage.setItem('agentCapabilities', agentCapabilities);
    localStorage.setItem('text_api_provider', textApiProvider);
    setTextModelPowerMode(deepThinkingEnabled ? 'deep-thinking' : 'low-power');

    // 3. Virse
    localStorage.setItem('virse_api_key', virseApiKey.trim());
    localStorage.setItem('virse_base_url', virseBaseUrl);
    localStorage.setItem('virse_enabled', String(virseEnabled));
    localStorage.setItem('virse_space_id', virseSpaceId);
    localStorage.setItem('virse_canvas_id', virseCanvasId);
    localStorage.setItem('virse_model', virseModel);

    // 4. Relays
    const trimmedNative = nativeApiKey.trim();
    localStorage.setItem('user_api_key', trimmedNative);
    localStorage.setItem('user_gemini_api_key', trimmedNative);
    localStorage.setItem('native_enabled', String(nativeEnabled));

    localStorage.setItem('deepseek_api_key', deepSeekApiKey.trim());
    localStorage.setItem('deepseek_base_url', deepSeekBaseUrl.trim() || DEFAULT_DEEPSEEK_BASE_URL);
    localStorage.setItem('deepseek_model', DEEPSEEK_AUTO_MODEL);
    localStorage.setItem('deepseek_reasoning_effort', deepSeekReasoning);
    localStorage.setItem('deepseek_enabled', String(deepSeekEnabled));

    localStorage.setItem('yunwu_api_key', yunwuApiKey.trim());
    localStorage.setItem('yunwu_base_url', yunwuBaseUrl.trim() || 'https://yunwu.ai');
    localStorage.setItem('yunwu_enabled', String(yunwuEnabled));

    localStorage.setItem('plato_api_key', platoApiKey.trim());
    localStorage.setItem('plato_base_url', platoBaseUrl.trim() || 'https://api.apilio.ai');
    localStorage.setItem('plato_enabled', String(platoEnabled));

    localStorage.setItem('volcengine_api_key', volcengineApiKey.trim());
    localStorage.setItem('seedance_api_key', volcengineApiKey.trim());
    localStorage.setItem('seedance_enabled', String(volcengineEnabled));

    // 5. Image Host
    localStorage.setItem('image_host_provider', imageHostProvider);
    localStorage.setItem('imgbb_api_key', imgbbApiKey.trim());
    localStorage.setItem('freeimage_api_key', freeimageApiKey.trim());

    // Dispatch global events
    window.dispatchEvent(new Event('agent-settings-updated'));
    window.dispatchEvent(new Event('api-settings-updated'));
    window.dispatchEvent(new CustomEvent('protocols-updated'));

    showToast('所有配置已成功保存！');
  };

  // Stats calculation
  const totalProtocols = ALL_PROTOCOLS.length;
  const configuredCount = Object.values(protocolConfigs).filter((c) => c.enabled || Boolean(c.apiKey)).length;
  const activeCount = Object.values(protocolConfigs).filter((c) => c.enabled && Boolean(c.apiKey)).length;

  const renderVirseCard = () => (
    <div
      className={`p-7 lg:p-8 rounded-3xl border transition-all ${
        virseEnabled
          ? 'bg-white dark:bg-[#12161F] border-violet-200 dark:border-violet-500/30 ring-1 ring-violet-500/20 shadow-sm'
          : 'bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/5 opacity-80'
      }`}
    >
      {/* Virse Card Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3.5">
          <div
            className={`p-3 rounded-2xl ${
              virseEnabled
                ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400'
                : 'bg-slate-200 dark:bg-white/10 text-slate-500'
            }`}
          >
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4
                className={`text-lg font-black ${
                  virseEnabled ? 'text-slate-900 dark:text-white' : 'text-slate-500'
                }`}
              >
                Virse 创意平台
              </h4>
              <span className="px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 text-[10px] font-black">
                MCP
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              连接 Virse 图片模型、工作区与创意画布
            </p>
          </div>
        </div>

        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={virseEnabled}
            onChange={(e) => {
              const nextEnabled = e.target.checked;
              setVirseEnabled(nextEnabled);
              localStorage.setItem('virse_enabled', String(nextEnabled));
              window.dispatchEvent(new Event('api-settings-updated'));
            }}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-white/10 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600" />
        </label>
      </div>

      {virseEnabled && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
          {/* API 节点 */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <Globe className="w-4 h-4 text-violet-500" /> API 节点
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  if (virseBaseUrl === DEFAULT_VIRSE_BASE_URL) return;
                  setVirseBaseUrl(DEFAULT_VIRSE_BASE_URL);
                  setVirseSpaceId('');
                  setVirseCanvasId('');
                  setVirseWorkspaces([]);
                  setVirseTestStatus('idle');
                }}
                disabled={virseTestStatus === 'testing'}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                  virseBaseUrl === DEFAULT_VIRSE_BASE_URL
                    ? 'bg-violet-50 dark:bg-violet-500/20 border-violet-200 dark:border-violet-500/30 text-violet-600 dark:text-violet-300'
                    : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                API 节点（默认/新版）
              </button>
              <button
                type="button"
                onClick={() => {
                  if (virseBaseUrl === VIRSE_DEV_BASE_URL) return;
                  setVirseBaseUrl(VIRSE_DEV_BASE_URL);
                  setVirseSpaceId('');
                  setVirseCanvasId('');
                  setVirseWorkspaces([]);
                  setVirseTestStatus('idle');
                }}
                disabled={virseTestStatus === 'testing'}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                  virseBaseUrl === VIRSE_DEV_BASE_URL
                    ? 'bg-violet-50 dark:bg-violet-500/20 border-violet-200 dark:border-violet-500/30 text-violet-600 dark:text-violet-300'
                    : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Dev 节点（备用/认证文档）
              </button>
            </div>
            <div className="px-4 py-2.5 rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20 text-xs font-mono text-violet-700 dark:text-violet-300">
              {virseBaseUrl}/mcp
            </div>
          </div>

          {/* Virse API Key */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <Key className="w-4 h-4 text-violet-500" /> Virse API Key
            </label>
            <div className="relative">
              <textarea
                value={virseApiKey}
                disabled={virseTestStatus === 'testing'}
                onChange={(e) => {
                  setVirseApiKey(e.target.value);
                  setVirseSpaceId('');
                  setVirseCanvasId('');
                  setVirseWorkspaces([]);
                  setVirseTestStatus('idle');
                  setVirseTestMessage('');
                }}
                rows={2}
                style={
                  {
                    WebkitTextSecurity: isVirseKeyVisible ? 'none' : 'disc',
                  } as React.CSSProperties
                }
                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-violet-500/20 outline-none font-mono resize-none text-slate-900 dark:text-white"
                placeholder="virse_sk_..."
              />
              <button
                type="button"
                onClick={() => setIsVirseKeyVisible(!isVirseKeyVisible)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                {isVirseKeyVisible ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              在 Virse 获取 API Key；测试连接会同步账户、工作区和实时模型列表。
            </p>
          </div>

          {/* Workspaces & Models Selectors */}
          {virseWorkspaces.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  目标工作区 / 画布
                </label>
                <select
                  value={
                    virseSpaceId && virseCanvasId
                      ? JSON.stringify([virseSpaceId, virseCanvasId])
                      : ''
                  }
                  disabled={virseTestStatus === 'testing'}
                  onChange={(e) => {
                    const workspace = virseWorkspaces.find(
                      (item) =>
                        JSON.stringify([item.space_id, item.canvas_id]) ===
                        e.target.value
                    );
                    if (!workspace) return;
                    setVirseCanvasId(workspace.canvas_id);
                    setVirseSpaceId(workspace.space_id);
                    localStorage.setItem('virse_canvas_id', workspace.canvas_id);
                    localStorage.setItem('virse_space_id', workspace.space_id);
                    window.dispatchEvent(new Event('api-settings-updated'));
                  }}
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs outline-none text-slate-800 dark:text-slate-200"
                >
                  <option value="" disabled>
                    请选择目标画布
                  </option>
                  {virseWorkspaces.map((workspace) => (
                    <option
                      key={JSON.stringify([
                        workspace.space_id,
                        workspace.canvas_id,
                      ])}
                      value={JSON.stringify([
                        workspace.space_id,
                        workspace.canvas_id,
                      ])}
                    >
                      {workspace.name ||
                        workspace.organization_name ||
                        workspace.space_id}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400">
                  选择后立即生效。切回页面时自动核验，移除失效画布。
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  默认图片模型
                </label>
                <select
                  value={virseModel}
                  onChange={(e) => setVirseModel(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs outline-none text-slate-800 dark:text-slate-200"
                >
                  {virseModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name || model.id}
                      {model.provider ? ` · ${model.provider}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Test Status & Sync Button */}
          <div className="flex items-center justify-between gap-4 pt-2">
            <div className="flex-1 min-w-0">
              {virseTestStatus !== 'idle' && (
                <span
                  className={`text-xs font-bold break-words ${
                    virseTestStatus === 'success'
                      ? 'text-emerald-500'
                      : virseTestStatus === 'testing'
                      ? 'text-blue-500'
                      : 'text-red-500'
                  }`}
                >
                  {virseTestMessage}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleTestVirse}
              disabled={virseTestStatus === 'testing'}
              className="px-5 py-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-700 text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 shrink-0"
            >
              {virseTestStatus === 'testing' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>测试并同步</span>
            </button>
          </div>

          {/* Diagnostics */}
          <div>
            <button
              type="button"
              disabled={
                !virseApiKey.trim() ||
                virseDiagnosticLoading ||
                virseTestStatus === 'testing'
              }
              onClick={async () => {
                const version = virseSyncVersion.current;
                setVirseDiagnosticLoading(true);
                try {
                  const diagnostic = await getVirseWorkspaceDiagnostic(
                    virseApiKey.trim(),
                    virseBaseUrl
                  );
                  if (version === virseSyncVersion.current)
                    setVirseDiagnostic(diagnostic);
                } catch {
                  if (version === virseSyncVersion.current)
                    setVirseDiagnostic('诊断请求失败，请稍后重试。');
                } finally {
                  setVirseDiagnosticLoading(false);
                }
              }}
              className="text-xs text-violet-600 dark:text-violet-400 hover:underline disabled:opacity-50"
            >
              {virseDiagnosticLoading
                ? '正在读取工作区诊断…'
                : '工作区列表不一致？读取诊断'}
            </button>
            {virseDiagnostic && (
              <details className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/70 dark:bg-amber-500/10 dark:border-amber-500/30 p-4">
                <summary className="cursor-pointer text-xs font-bold text-amber-700 dark:text-amber-300">
                  展开查看工作区诊断（不含 API Key）
                </summary>
                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-all text-[11px] leading-5 text-slate-700 dark:text-slate-200 select-text">
                  {virseDiagnostic}
                </pre>
              </details>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen w-full flex-col bg-[#F8FAFC] dark:bg-[#07090E] text-slate-800 dark:text-slate-100 font-sans overflow-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[250] flex items-center gap-2.5 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-xl shadow-emerald-900/30 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="h-4 w-4" />
          {toastMessage}
        </div>
      )}

      {/* Main Content Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar matching Screenshots 1 & 2 */}
        <aside className="w-64 md:w-68 border-r border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#0B0F14] p-4 flex flex-col gap-1 shrink-0 overflow-y-auto select-none">
          {/* Brand & Version Header */}
          <div className="px-2.5 py-2 mb-2 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2 font-black text-sm text-slate-900 dark:text-white">
              <img src="/jingche-logo.png" alt="境彻" className="w-5 h-5 rounded-md object-cover" />
              <span>境彻</span>
              <span className="text-[11px] text-slate-400 font-normal">v1.5.6</span>
            </div>
          </div>

          {/* Group 1: 概览 */}
          <div className="mt-1 px-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            概览
          </div>
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-bold text-xs ${
              activeTab === 'overview'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <Activity className="h-4 w-4" />
            <span>数据概览</span>
          </button>

          {/* Group 2: 平台资源 */}
          <div className="mt-3 px-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            平台资源
          </div>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-bold text-xs ${
              activeTab === 'users'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>用户管理</span>
          </button>

          <button
            onClick={() => setActiveTab('protocols')}
            className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all font-bold text-xs ${
              activeTab === 'protocols'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-3">
              <Workflow className="h-4 w-4" />
              <span>系统渠道</span>
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
              activeTab === 'protocols' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-500'
            }`}>
              协议
            </span>
          </button>

          <button
            onClick={() => setActiveTab('plugins')}
            className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all font-bold text-xs ${
              activeTab === 'plugins'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-3">
              <Plug className="h-4 w-4" />
              <span>插件管理</span>
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
              activeTab === 'plugins' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-500'
            }`}>
              扩展
            </span>
          </button>

          <button
            onClick={() => setActiveTab('prompts')}
            className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all font-bold text-xs ${
              activeTab === 'prompts'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-3">
              <Sparkles className="h-4 w-4" />
              <span>提示词模板</span>
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
              activeTab === 'prompts' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-500'
            }`}>
              版本
            </span>
          </button>

          <button
            onClick={() => setActiveTab('storage')}
            className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all font-bold text-xs ${
              activeTab === 'storage'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-3">
              <Server className="h-4 w-4" />
              <span>存储资源</span>
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
              activeTab === 'storage' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-500'
            }`}>
              本地/对象
            </span>
          </button>

          {/* Group 3: 系统配置 */}
          <div className="mt-3 px-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            系统配置
          </div>

          <button
            onClick={() => setActiveTab('image-host')}
            className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all font-bold text-xs ${
              activeTab === 'image-host'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-3">
              <ImageIcon className="h-4 w-4" />
              <span>图床服务</span>
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
              activeTab === 'image-host' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-500'
            }`}>
              外置
            </span>
          </button>

          <button
            onClick={() => setActiveTab('relays')}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-bold text-xs ${
              activeTab === 'relays'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <Zap className="h-4 w-4" />
            <span>常用中转与原生</span>
          </button>

          <button
            onClick={() => setActiveTab('virse')}
            className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all font-bold text-xs ${
              activeTab === 'virse'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-3">
              <Sparkles className="h-4 w-4 text-violet-400" />
              <span>Virse 创意平台</span>
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
              activeTab === 'virse' ? 'bg-white/20 text-white' : 'bg-violet-500/10 text-violet-600 dark:text-violet-400'
            }`}>
              MCP
            </span>
          </button>

          <button
            onClick={() => setActiveTab('cache')}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-bold text-xs ${
              activeTab === 'cache'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <HardDrive className="h-4 w-4" />
            <span>缓存磁盘</span>
          </button>

          {/* Bottom Back Button matching User Requirement */}
          <div className="mt-auto pt-3 border-t border-slate-200/80 dark:border-white/10">
            <button
              onClick={onBack}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 font-bold text-xs transition-all group"
            >
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white" />
              <span>返回创作台</span>
            </button>
          </div>
        </aside>

        {/* Right Tab Content View */}
        <main className={`flex-1 overflow-hidden ${
          activeTab === 'overview' || activeTab === 'users' || activeTab === 'protocols' || activeTab === 'plugins' || activeTab === 'prompts' || activeTab === 'storage' || activeTab === 'image-host'
            ? 'flex flex-col'
            : 'overflow-y-auto p-6 md:p-8 lg:p-10'
        }`}>
          {/* TAB 0: 数据概览 (图 1) */}
          {activeTab === 'overview' && (
            <DataOverviewDashboard onNotify={showToast} />
          )}

          {/* TAB 1: 用户管理 (图 2) */}
          {activeTab === 'users' && (
            <UserManagementPage onNotify={showToast} />
          )}

          {/* TAB 2: 系统渠道与模型管理 (图 2, 3, 4 架构) */}
          {activeTab === 'protocols' && (
            <SystemChannelSettings onNotify={showToast} />
          )}

          {/* TAB 2.5: 插件管理 (图 1, 2, 3 规范与真实协议) */}
          {activeTab === 'plugins' && (
            <PluginManagementPage onNotify={showToast} />
          )}

          {/* TAB 2.6: 提示词模板 (完全复刻图 1、图 3，包含图 4 全部 22 个能力) */}
          {activeTab === 'prompts' && (
            <PromptTemplateManagementPage onNotify={showToast} />
          )}
          {false && activeTab === 'protocols' && (
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Stat Banners */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#12161F] p-4 shadow-sm">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
                    <span>文本对话协议</span>
                    <MessageCircle className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">33 个</div>
                  <div className="text-[11px] text-slate-400 mt-1">支持 21 个 Agent 工具调用</div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#12161F] p-4 shadow-sm">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
                    <span>图像生成协议</span>
                    <ImageIcon className="h-4 w-4 text-purple-500" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">27 个</div>
                  <div className="text-[11px] text-slate-400 mt-1">含文生图/图生图/去背解构</div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#12161F] p-4 shadow-sm">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
                    <span>当前默认文本</span>
                    <Activity className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="text-base font-black text-slate-900 dark:text-white truncate">
                    {PROTOCOLS_BY_ID[defaultTextId]?.label || defaultTextId}
                  </div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">核心对话 / Agent 主通道</div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#12161F] p-4 shadow-sm">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
                    <span>当前默认图像</span>
                    <Sparkles className="h-4 w-4 text-brand-orange" />
                  </div>
                  <div className="text-base font-black text-slate-900 dark:text-white truncate">
                    {PROTOCOLS_BY_ID[defaultImageId]?.label || defaultImageId}
                  </div>
                  <div className="text-[11px] text-brand-orange mt-1">主图 / 换脸 / 融图主通道</div>
                </div>
              </div>

              {/* Filter and Search Bar */}
              <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#12161F] p-5 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Category Pills */}
                  <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
                    <button
                      onClick={() => setSelectedCategory('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        selectedCategory === 'all'
                          ? 'bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      全部 ({totalProtocols})
                    </button>
                    <button
                      onClick={() => setSelectedCategory('text')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        selectedCategory === 'text'
                          ? 'bg-white dark:bg-white/15 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <MessageCircle className="h-3 w-3" />
                      文本 (33)
                    </button>
                    <button
                      onClick={() => setSelectedCategory('image')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        selectedCategory === 'image'
                          ? 'bg-white dark:bg-white/15 text-purple-600 dark:text-purple-400 shadow-sm'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <ImageIcon className="h-3 w-3" />
                      图像 (27)
                    </button>
                    <button
                      onClick={() => setSelectedCategory('agent')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        selectedCategory === 'agent'
                          ? 'bg-white dark:bg-white/15 text-brand-orange shadow-sm'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Bot className="h-3 w-3" />
                      支持 Agent (21)
                    </button>
                    <button
                      onClick={() => setSelectedCategory('configured')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        selectedCategory === 'configured'
                          ? 'bg-white dark:bg-white/15 text-emerald-600 dark:text-emerald-400 shadow-sm'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Check className="h-3 w-3" />
                      已配置 ({configuredCount})
                    </button>
                  </div>

                  {/* Search Input */}
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜索协议名称、Provider ID、Endpoint、模型..."
                      className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-orange/60"
                    />
                  </div>
                </div>

                {/* Vendor Chips Filter */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-white/5 overflow-x-auto pb-1 text-xs">
                  <span className="text-slate-400 font-bold shrink-0 flex items-center gap-1">
                    <Filter className="h-3 w-3" /> 厂商筛选:
                  </span>
                  <button
                    onClick={() => setSelectedVendor('all')}
                    className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-all ${
                      selectedVendor === 'all'
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                        : 'bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    全部厂商
                  </button>
                  {allVendors.map((vendor) => (
                    <button
                      key={vendor}
                      onClick={() => setSelectedVendor(vendor)}
                      className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-all ${
                        selectedVendor === vendor
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                          : 'bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {vendor}
                    </button>
                  ))}
                </div>
              </div>

              {/* Protocol Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredProtocols.map((protocol) => {
                  const config = protocolConfigs[protocol.providerId] || {
                    providerId: protocol.providerId,
                    enabled: false,
                    baseUrl: protocol.baseUrl,
                    apiKey: '',
                    defaultModel: protocol.recommendedModels?.[0] || '',
                  };
                  const isExpanded = !!expandedCards[protocol.providerId];
                  const isKeyVisible = !!visibleKeys[protocol.providerId];
                  const testState = testStates[protocol.providerId];
                  const isDefault =
                    protocol.category === 'text'
                      ? defaultTextId === protocol.providerId
                      : defaultImageId === protocol.providerId;

                  return (
                    <div
                      key={protocol.providerId}
                      className={`rounded-2xl border transition-all duration-200 bg-white dark:bg-[#12161F] flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md ${
                        config.enabled
                          ? 'border-brand-orange/40 ring-1 ring-brand-orange/20'
                          : 'border-slate-200/80 dark:border-white/10'
                      }`}
                    >
                      {/* Card Header */}
                      <div className="p-5 pb-3">
                        <div className="flex items-start justify-between gap-3 mb-2.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                              {protocol.vendor}
                            </span>

                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-bold flex items-center gap-1 ${
                                protocol.category === 'text'
                                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                  : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                              }`}
                            >
                              {protocol.category === 'text' ? <MessageCircle className="h-2.5 w-2.5" /> : <ImageIcon className="h-2.5 w-2.5" />}
                              {protocol.category === 'text' ? '文本对话' : '图像生成'}
                            </span>

                            {protocol.hasAgent && (
                              <span className="px-2 py-0.5 rounded-md bg-orange-500/10 text-brand-orange border border-orange-500/20 text-[11px] font-bold">
                                🤖 Agent 就绪
                              </span>
                            )}

                            {isDefault && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500 text-white text-[11px] font-bold shadow-sm">
                                默认{protocol.category === 'text' ? '文本' : '图像'}
                              </span>
                            )}
                          </div>

                          {/* Enable/Disable Toggle Switch */}
                          <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={config.enabled}
                              onChange={(e) =>
                                handleUpdateProtocolConfig(protocol.providerId, {
                                  enabled: e.target.checked,
                                })
                              }
                              className="sr-only peer"
                            />
                            <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-white/10 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-orange" />
                          </label>
                        </div>

                        {/* Title and Provider ID */}
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-base font-black text-slate-900 dark:text-white leading-snug">
                            {protocol.label}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 font-mono">
                          <span>id: {protocol.providerId}</span>
                          <span>•</span>
                          <span className="text-[11px]">{protocol.createMethod} {protocol.createPath}</span>
                        </div>

                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                          {protocol.description}
                        </p>
                      </div>

                      {/* Card Configuration Form */}
                      <div className="px-5 py-3 bg-slate-50/60 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5 space-y-3">
                        {/* API Key */}
                        <div>
                          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between mb-1">
                            <span className="flex items-center gap-1">
                              <Key className="h-3 w-3" /> API Key / 凭据:
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {protocol.authType === 'none' ? '免鉴权' : `驱动: ${protocol.authType}`}
                            </span>
                          </label>
                          <div className="relative">
                            <input
                              type={isKeyVisible ? 'text' : 'password'}
                              value={config.apiKey || ''}
                              onChange={(e) =>
                                handleUpdateProtocolConfig(protocol.providerId, {
                                  apiKey: e.target.value,
                                })
                              }
                              placeholder={protocol.authType === 'none' ? '本地服务无需 API Key' : 'sk-... 或 API Key'}
                              className="w-full pr-8 pl-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-brand-orange"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setVisibleKeys((prev) => ({
                                  ...prev,
                                  [protocol.providerId]: !prev[protocol.providerId],
                                }))
                              }
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                            >
                              {isKeyVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>

                        {/* Collapsible details for BaseURL & Model */}
                        {isExpanded && (
                          <div className="space-y-3 pt-2 border-t border-slate-200/60 dark:border-white/5">
                            {/* Base URL */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                  Base URL:
                                </label>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateProtocolConfig(protocol.providerId, {
                                      baseUrl: protocol.baseUrl,
                                    })
                                  }
                                  className="text-[10px] text-brand-orange hover:underline"
                                >
                                  重置官方默认
                                </button>
                              </div>
                              <input
                                type="text"
                                value={config.baseUrl || protocol.baseUrl}
                                onChange={(e) =>
                                  handleUpdateProtocolConfig(protocol.providerId, {
                                    baseUrl: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-brand-orange"
                              />
                            </div>

                            {/* Default Model */}
                            <div>
                              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                                默认模型:
                              </label>
                              {protocol.recommendedModels && protocol.recommendedModels.length > 0 ? (
                                <div className="space-y-1.5">
                                  <input
                                    type="text"
                                    value={config.defaultModel || protocol.recommendedModels[0]}
                                    onChange={(e) =>
                                      handleUpdateProtocolConfig(protocol.providerId, {
                                        defaultModel: e.target.value,
                                      })
                                    }
                                    placeholder="输入自定义模型 ID 或从下方选择"
                                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-brand-orange"
                                  />
                                  <div className="flex flex-wrap gap-1">
                                    {protocol.recommendedModels.map((m) => (
                                      <button
                                        key={m}
                                        type="button"
                                        onClick={() =>
                                          handleUpdateProtocolConfig(protocol.providerId, {
                                            defaultModel: m,
                                          })
                                        }
                                        className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all ${
                                          config.defaultModel === m
                                            ? 'bg-brand-orange text-white border-brand-orange'
                                            : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-brand-orange/40'
                                        }`}
                                      >
                                        {m}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  value={config.defaultModel || ''}
                                  onChange={(e) =>
                                    handleUpdateProtocolConfig(protocol.providerId, {
                                      defaultModel: e.target.value,
                                    })
                                  }
                                  placeholder="如 deepseek-chat 或 gpt-4o"
                                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-brand-orange"
                                />
                              )}
                            </div>
                          </div>
                        )}

                        {/* Test Status Feedback */}
                        {testState && (
                          <div
                            className={`p-2.5 rounded-xl text-xs flex items-center justify-between ${
                              testState.loading
                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                : testState.success
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'bg-red-500/10 text-red-600 dark:text-red-400'
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              {testState.loading ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              ) : testState.success ? (
                                <Check className="h-3.5 w-3.5" />
                              ) : (
                                <AlertTriangle className="h-3.5 w-3.5" />
                              )}
                              <span className="font-medium">{testState.message}</span>
                            </span>
                            {testState.latency && testState.latency > 0 && (
                              <span className="font-mono text-[10px] shrink-0">{testState.latency}ms</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Card Footer Actions */}
                      <div className="px-5 py-3 bg-white dark:bg-[#12161F] border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleTestProtocol(protocol)}
                            disabled={testState?.loading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-brand-orange transition-all disabled:opacity-50"
                          >
                            {testState?.loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5 text-brand-orange" />}
                            <span>测试连接</span>
                          </button>

                          {!isDefault && (
                            <button
                              type="button"
                              onClick={() => handleSetDefault(protocol.category, protocol.providerId)}
                              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/30 transition-all"
                            >
                              设为默认
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setDetailProtocol(protocol)}
                            className="flex items-center gap-1 p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-medium rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                            title="查看协议规范与参数文档"
                          >
                            <Code className="h-4 w-4" />
                            <span className="hidden sm:inline">文档</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setExpandedCards((prev) => ({
                                ...prev,
                                [protocol.providerId]: !prev[protocol.providerId],
                              }))
                            }
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                            title={isExpanded ? '收起配置' : '展开高级配置'}
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: Virse 创意平台 */}
          {activeTab === 'virse' && (
            <div className="max-w-4xl mx-auto space-y-6">
              {renderVirseCard()}
            </div>
          )}

          {/* TAB 2: 常用中转与原生 (Quick Relays) */}
          {activeTab === 'relays' && (
            <div className="max-w-4xl mx-auto space-y-6">
              {renderVirseCard()}

              <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#12161F] p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                      <Bot className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white">DeepSeek 原生 API</h3>
                      <p className="text-xs text-slate-400">官方原生高精度 Agent 推理与长文本通道</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deepSeekEnabled}
                      onChange={(e) => setDeepSeekEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-white/10 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-orange" />
                  </label>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      DeepSeek API Key
                    </label>
                    <div className="relative">
                      <input
                        type={isDeepSeekKeyVisible ? 'text' : 'password'}
                        value={deepSeekApiKey}
                        onChange={(e) => setDeepSeekApiKey(e.target.value)}
                        placeholder="sk-..."
                        className="w-full pl-3 pr-10 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm font-mono focus:outline-none focus:border-brand-orange"
                      />
                      <button
                        type="button"
                        onClick={() => setIsDeepSeekKeyVisible(!isDeepSeekKeyVisible)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                      >
                        {isDeepSeekKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      Base URL (默认官方: https://api.deepseek.com)
                    </label>
                    <input
                      type="text"
                      value={deepSeekBaseUrl}
                      onChange={(e) => setDeepSeekBaseUrl(e.target.value)}
                      placeholder="https://api.deepseek.com"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm font-mono focus:outline-none focus:border-brand-orange"
                    />
                  </div>

                  {deepSeekTestMessage && (
                    <div className={`p-3 rounded-xl text-xs font-medium ${
                      deepSeekTestStatus === 'success'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : deepSeekTestStatus === 'error'
                        ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                        : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    }`}>
                      {deepSeekTestMessage}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleTestDeepSeekRelay}
                      disabled={deepSeekTestStatus === 'testing'}
                      className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-all flex items-center gap-1.5 shadow-sm"
                    >
                      {deepSeekTestStatus === 'testing' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
                      <span>测试连接</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Other Quick Relays: Plato, Yunwu, Volcengine, Native Gemini */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Plato */}
                <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#12161F] p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-slate-900 dark:text-white">柏拉图 API 中转站</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={platoEnabled}
                        onChange={(e) => setPlatoEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-white/10 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-orange" />
                    </label>
                  </div>
                  <input
                    type="password"
                    value={platoApiKey}
                    onChange={(e) => setPlatoApiKey(e.target.value)}
                    placeholder="柏拉图 API Key"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs font-mono"
                  />
                  <input
                    type="text"
                    value={platoBaseUrl}
                    onChange={(e) => setPlatoBaseUrl(e.target.value)}
                    placeholder="Base URL"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs font-mono"
                  />
                </div>

                {/* Yunwu */}
                <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#12161F] p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-slate-900 dark:text-white">云雾 API 中转站</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={yunwuEnabled}
                        onChange={(e) => setYunwuEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-white/10 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-orange" />
                    </label>
                  </div>
                  <input
                    type="password"
                    value={yunwuApiKey}
                    onChange={(e) => setYunwuApiKey(e.target.value)}
                    placeholder="云雾 API Key"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs font-mono"
                  />
                  <input
                    type="text"
                    value={yunwuBaseUrl}
                    onChange={(e) => setYunwuBaseUrl(e.target.value)}
                    placeholder="Base URL"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs font-mono"
                  />
                </div>

                {/* Volcengine */}
                <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#12161F] p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-slate-900 dark:text-white">火山引擎方舟 / Seedream</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={volcengineEnabled}
                        onChange={(e) => setVolcengineEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-white/10 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-orange" />
                    </label>
                  </div>
                  <input
                    type="password"
                    value={volcengineApiKey}
                    onChange={(e) => setVolcengineApiKey(e.target.value)}
                    placeholder="火山引擎 API Key"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs font-mono"
                  />
                </div>

                {/* Google Native */}
                <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#12161F] p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-slate-900 dark:text-white">Google Gemini 原生 API</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={nativeEnabled}
                        onChange={(e) => setNativeEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-white/10 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-orange" />
                    </label>
                  </div>
                  <input
                    type="password"
                    value={nativeApiKey}
                    onChange={(e) => setNativeApiKey(e.target.value)}
                    placeholder="AIzaSy... Gemini API Key"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}


          {/* TAB 4: 缓存磁盘 */}
          {activeTab === 'cache' && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#12161F] p-6 shadow-sm space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                      <HardDrive className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white">本地持久化与缓存磁盘</h3>
                      <p className="text-xs text-slate-400">管理 IndexedDB 数据库中保存的临时图片、生成任务及离线数据</p>
                    </div>
                  </div>
                  <button
                    onClick={loadCacheStats}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-xl border border-slate-200/80 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02] p-4 text-center">
                    <div className="text-xs text-slate-400 font-bold mb-1">图片缓存</div>
                    <div className="text-xl font-black text-slate-900 dark:text-white">{formatBytes(cacheStats?.imageBytes)}</div>
                    <div className="text-[11px] text-slate-400 mt-1">{cacheStats?.imageCount || 0} 个对象</div>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02] p-4 text-center">
                    <div className="text-xs text-slate-400 font-bold mb-1">视频缓存</div>
                    <div className="text-xl font-black text-slate-900 dark:text-white">{formatBytes(cacheStats?.videoBytes)}</div>
                    <div className="text-[11px] text-slate-400 mt-1">{cacheStats?.videoCount || 0} 个对象</div>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02] p-4 text-center">
                    <div className="text-xs text-slate-400 font-bold mb-1">总存储占用</div>
                    <div className="text-xl font-black text-brand-orange">{formatBytes(cacheStats?.totalBytes)}</div>
                    <div className="text-[11px] text-slate-400 mt-1">{cacheStats?.totalCount || 0} 项缓存</div>
                  </div>
                </div>

                {cacheMessage && (
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 text-xs font-bold text-center">
                    {cacheMessage}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/5">
                  <button
                    onClick={() => handleClearCache('expired')}
                    disabled={cacheBusy}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-50"
                  >
                    清理过期缓存
                  </button>
                  <button
                    onClick={() => handleClearCache('images')}
                    disabled={cacheBusy}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-50"
                  >
                    仅清理图片
                  </button>
                  <button
                    onClick={() => handleClearCache('all')}
                    disabled={cacheBusy}
                    className="px-4 py-2 rounded-xl bg-red-600/10 text-red-600 dark:text-red-400 border border-red-500/20 text-xs font-bold hover:bg-red-600/20 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    清空所有缓存
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: 独立外置图床服务 (UI 与存储服务完全一致) */}
          {activeTab === 'image-host' && (
            <ImageHostServiceSettings onNotify={showToast} />
          )}

          {/* TAB 6: 存储服务 (系统级存储: 本地 / 阿里云 OSS / 腾讯云 COS / 七牛云 Kodo / S3) */}
          {activeTab === 'storage' && (
            <StorageServiceSettings onNotify={showToast} />
          )}
        </main>
      </div>

      {/* Protocol Detail Spec Modal */}
      {detailProtocol && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-2xl max-h-[85vh] rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#12161F] shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-white/5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-orange/10 text-brand-orange">
                    {detailProtocol.vendor}
                  </span>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {detailProtocol.label}
                  </h3>
                </div>
                <div className="text-xs text-slate-400 font-mono mt-1">
                  插件目录: plugin-packages/{detailProtocol.packageDir}
                </div>
              </div>
              <button
                onClick={() => setDetailProtocol(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar text-sm">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">协议概述</h4>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-white/[0.02] p-3 rounded-xl border border-slate-100 dark:border-white/5">
                  {detailProtocol.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5">
                  <div className="text-slate-400 mb-1">默认 Base URL:</div>
                  <div className="text-slate-800 dark:text-slate-200 break-all">{detailProtocol.baseUrl}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5">
                  <div className="text-slate-400 mb-1">请求接口 (Create Endpoint):</div>
                  <div className="text-slate-800 dark:text-slate-200 font-bold">{detailProtocol.createMethod} {detailProtocol.createPath}</div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  支持的标准入参清单 ({detailProtocol.parameters.length} 项)
                </h4>
                <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-white/5 text-slate-400 font-bold">
                      <tr>
                        <th className="p-2.5">参数名</th>
                        <th className="p-2.5">类型</th>
                        <th className="p-2.5">必填</th>
                        <th className="p-2.5">说明</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {detailProtocol.parameters.map((param) => (
                        <tr key={param.name}>
                          <td className="p-2.5 font-mono font-bold text-slate-800 dark:text-slate-200">{param.name}</td>
                          <td className="p-2.5 font-mono text-slate-500">{param.type}</td>
                          <td className="p-2.5">{param.required ? <span className="text-red-500 font-bold">是</span> : <span className="text-slate-400">否</span>}</td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-300">{param.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5 flex justify-end">
              <button
                onClick={() => setDetailProtocol(null)}
                className="px-5 py-2 rounded-xl bg-brand-orange text-white text-xs font-bold hover:brightness-105"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedSettingsPage;
