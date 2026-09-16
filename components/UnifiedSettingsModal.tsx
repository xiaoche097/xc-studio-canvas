import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Save, 
  Bot, 
  BookOpen, 
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
  Sparkles,
  MessageCircle,
  Trash2,
  CheckCircle2,
  Copy,
  HelpCircle,
  HardDrive,
  Database,
  Image as ImageIcon
} from 'lucide-react';
import {
  DEEP_THINKING_TEXT_MODELS,
  getTextModelPowerMode,
  LOW_POWER_TEXT_MODELS,
  resolveRuntimeModelId,
  setTextModelPowerMode,
} from '../Cyzx4/utils/apiHelpers';
import { storageService, CacheStats } from '../services/storageService';
import { deleteFromStorage } from '../XcAISTUDIO-main/services/storage';
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
import {
  DEFAULT_XIAOCHE_BASE_URL,
  XIAOCHE_IMAGE_MODELS,
  XIAOCHE_MODELS,
  XIAOCHE_VIDEO_MODELS,
} from '../Cyzx4/utils/xiaocheModels';
import {
  DEFAULT_DEEPSEEK_BASE_URL,
  DEEPSEEK_SERVER_MANAGED,
} from '../Cyzx4/services/provider-config';
import { testDeepSeekConnection } from '../Cyzx4/services/agents/runtime/deepseek-adapter';
import {
  DEEPSEEK_AUTO_MODEL,
  DEEPSEEK_FLASH_MODEL,
  DEEPSEEK_PRO_MODEL,
} from '../Cyzx4/services/deepseek-model-router';

interface UnifiedSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'model' | 'agent' | 'cache' | 'image-host';
}

const DEFAULT_BASE_URL = 'https://yunwu.ai';
const YUNWU_OVERSEAS_BASE_URL = 'https://api.openlux.ai';
const DEFAULT_PLATO_BASE_URL = 'https://api.apilio.ai';
const DEFAULT_VOLCENGINE_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
const DEFAULT_RUNNINGHUB_BASE_URL = 'https://www.runninghub.cn';
const QWEN_IMAGE_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const DEFAULT_VIRSE_BASE_URL = 'https://api.virse.ai';
const VIRSE_DEV_BASE_URL = 'https://dev.virse.ai';
const LEGACY_JIJING_BASE_URL = 'https://api.jijing.ai';
const DEFAULT_NO1_IMAGE_BASE_URL = 'https://api.rcouyi.com';
const NO1_IMAGE_NODES = [
  { name: 'DCDN主站', url: 'https://api.rcouyi.com' },
  { name: '美国芝加哥OVH线路', url: 'https://us.rcouyi.com' },
  { name: '美国华盛顿OVH线路', url: 'https://us-1.rcouyi.com' },
  { name: '中国香港', url: 'https://hk-2.rcouyi.com' },
  { name: '美国洛杉矶OVH线路', url: 'https://us-3.rcouyi.com' },
  { name: '新加坡OVH线路', url: 'https://sgp.rcouyi.com' },
  { name: '日本软银线路', url: 'https://jp.rcouyi.com' },
  { name: '美国阿什本OVH线路', url: 'https://us-2.rcouyi.com' },
];
const DEFAULT_MODEL = 'gemini-3-pro-preview';
const AVAILABLE_MODELS = [
  { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash', description: '快速响应模型', badge: '推荐', type: 'text' },
  { id: 'gpt-5.5', name: 'GPT-5.5 Global', description: '顶尖逻辑推理模型', badge: 'New', type: 'text' },
  { id: 'claude-opus-4-7', name: 'Claude 4.7 Opus', description: '深度语义理解模型', badge: '专业', type: 'text' },
  { id: 'gpt-image-2', name: 'Imagen 2.0', description: '极致写实商业精修', badge: '图像', type: 'image' },
  { id: 'nanobanana2', name: 'Banana 2.0', description: '高品质商业创意模型', badge: 'New', type: 'image' },
  { id: 'nanobananapro', name: 'Banana Pro', description: '专业级摄影写实模型', badge: 'Pro', type: 'image' },
];

// ==================== API 客户端 (用于测试连接) ====================
const sendTestRequest = async (
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string
): Promise<{ text: string }> => {
  const modelsToTry = [
    model,
    model === 'gemini-3.5-flash' ? 'gemini-3.1-flash-lite' : 'gemini-3.5-flash',
    'gemini-3.1-flash-lite-preview'
  ];

  let lastError = null;
  for (const currentModel of modelsToTry) {
    try {
      const url = `${baseUrl}/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 1, maxOutputTokens: 10 }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error?.message || `HTTP Error ${response.status}`;
        const lowerMessage = message.toLowerCase();

        // If it is an authentication/API key issue, throw it immediately to avoid unnecessary retries.
        if (
          lowerMessage.includes('api key') ||
          lowerMessage.includes('unauthorized') ||
          lowerMessage.includes('key not valid') ||
          response.status === 401 ||
          response.status === 403
        ) {
          throw new Error(message);
        }
        throw new Error(message);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return { text };
    } catch (e: any) {
      lastError = e;
    }
  }
  throw lastError || new Error('Connection failed');
};

const testVolcengineConnection = async (
  baseUrl: string,
  apiKey: string
): Promise<void> => {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const response = await fetch(`${normalizedBaseUrl}/models`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || errorData?.message || `HTTP Error ${response.status}`);
  }
  await response.json().catch(() => ({}));
};

export const UnifiedSettingsModal: React.FC<UnifiedSettingsModalProps> = ({ isOpen, onClose, initialTab = 'model' }) => {
  const [activeTab, setActiveTab] = useState<'model' | 'agent' | 'cache' | 'image-host'>(initialTab);

  // Agent Settings State
  const [agentName, setAgentName] = useState('XcAI 首席电商视觉策划师');
  const [agentRole, setAgentRole] = useState('你是一个拥有10年经验的亚马逊/独立站电商视觉总监。你的目标是根据用户提供的产品信息或图片，策划出高转化率的视觉方案。');
  const [agentCapabilities, setAgentCapabilities] = useState('1. 深入分析产品卖点与目标市场\n2. 策划高转化率的电商图片（主图、副图、A+）\n3. 保持专业、精炼的语言风格');
  const [deepThinkingEnabled, setDeepThinkingEnabled] = useState(false);
  const [textApiProvider, setTextApiProvider] = useState<'auto' | 'deepseek' | 'plato' | 'yunwu' | 'runninghub' | 'native'>('auto');

  // Model Settings State
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
  const [yunwuBaseUrl, setYunwuBaseUrl] = useState(DEFAULT_BASE_URL);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [isYunwuKeyVisible, setIsYunwuKeyVisible] = useState(false);
  const [yunwuEnabled, setYunwuEnabled] = useState(true);
  
  const [platoApiKey, setPlatoApiKey] = useState('');
  const [platoBaseUrl, setPlatoBaseUrl] = useState(DEFAULT_PLATO_BASE_URL);
  const [isPlatoKeyVisible, setIsPlatoKeyVisible] = useState(false);
  const [platoEnabled, setPlatoEnabled] = useState(false);

  const [jijingApiKey, setJijingApiKey] = useState('');
  const [jijingBaseUrl, setJijingBaseUrl] = useState(DEFAULT_NO1_IMAGE_BASE_URL);
  const [isJijingKeyVisible, setIsJijingKeyVisible] = useState(false);
  const [jijingEnabled, setJijingEnabled] = useState(false);

  const [runningHubApiKey, setRunningHubApiKey] = useState('');
  const [runningHubBaseUrl, setRunningHubBaseUrl] = useState(DEFAULT_RUNNINGHUB_BASE_URL);
  const [isRunningHubKeyVisible, setIsRunningHubKeyVisible] = useState(false);
  const [runningHubEnabled, setRunningHubEnabled] = useState(false);

  const [qwenApiKey, setQwenApiKey] = useState('');
  const [isQwenKeyVisible, setIsQwenKeyVisible] = useState(false);
  const [qwenEnabled, setQwenEnabled] = useState(false);

  const [virseApiKey, setVirseApiKey] = useState('');
  const [virseBaseUrl, setVirseBaseUrl] = useState(DEFAULT_VIRSE_BASE_URL);
  const [isVirseKeyVisible, setIsVirseKeyVisible] = useState(false);
  const [virseEnabled, setVirseEnabled] = useState(false);
  const [virseWorkspaces, setVirseWorkspaces] = useState<VirseWorkspace[]>([]);
  const [virseModels, setVirseModels] = useState<VirseImageModel[]>([]);
  const [virseCanvasId, setVirseCanvasId] = useState('');
  const [virseSpaceId, setVirseSpaceId] = useState('');
  const [virseModel, setVirseModel] = useState('nano-banana-2');

  const [xiaocheApiKey, setXiaocheApiKey] = useState('');
  const [xiaocheBaseUrl, setXiaocheBaseUrl] = useState(DEFAULT_XIAOCHE_BASE_URL);
  const [isXiaocheKeyVisible, setIsXiaocheKeyVisible] = useState(false);
  const [xiaocheEnabled, setXiaocheEnabled] = useState(false);

  const [volcengineApiKey, setVolcengineApiKey] = useState('');
  const [isVolcengineKeyVisible, setIsVolcengineKeyVisible] = useState(false);
  const [volcengineEnabled, setVolcengineEnabled] = useState(false);

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  // Individual section test statuses
  const [platoTestStatus, setPlatoTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [platoTestMessage, setPlatoTestMessage] = useState('');

  const [jijingTestStatus, setJijingTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [jijingTestMessage, setJijingTestMessage] = useState('');

  const [runningHubTestStatus, setRunningHubTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [runningHubTestMessage, setRunningHubTestMessage] = useState('');

  const [qwenTestStatus, setQwenTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [qwenTestMessage, setQwenTestMessage] = useState('');

  const [virseTestStatus, setVirseTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [virseTestMessage, setVirseTestMessage] = useState('');
  const [virseDiagnostic, setVirseDiagnostic] = useState('');
  const [virseDiagnosticLoading, setVirseDiagnosticLoading] = useState(false);
  const virseSyncVersion = useRef(0);
  useEffect(() => {
    virseSyncVersion.current += 1;
    return () => { virseSyncVersion.current += 1; };
  }, [isOpen, virseApiKey, virseBaseUrl]);

  const [xiaocheTestStatus, setXiaocheTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [xiaocheTestMessage, setXiaocheTestMessage] = useState('');
  
  const [yunwuTestStatus, setYunwuTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [yunwuTestMessage, setYunwuTestMessage] = useState('');

  const [nativeTestStatus, setNativeTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [nativeTestMessage, setNativeTestMessage] = useState('');
  const [volcengineTestStatus, setVolcengineTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [volcengineTestMessage, setVolcengineTestMessage] = useState('');
  const [showUsageGuide, setShowUsageGuide] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [cacheBusy, setCacheBusy] = useState(false);
  const [cacheMessage, setCacheMessage] = useState('');
  const [imageHostProvider, setImageHostProvider] = useState<'none' | 'imgbb' | 'freeimage'>('imgbb');
  const [imgbbApiKey, setImgbbApiKey] = useState('');
  const [isImgbbKeyVisible, setIsImgbbKeyVisible] = useState(false);
  const [imgbbTestStatus, setImgbbTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [imgbbTestMessage, setImgbbTestMessage] = useState('');

  const [freeimageApiKey, setFreeimageApiKey] = useState('');
  const [isFreeimageKeyVisible, setIsFreeimageKeyVisible] = useState(false);
  const [freeimageTestStatus, setFreeimageTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [freeimageTestMessage, setFreeimageTestMessage] = useState('');

  const nativeAutoTestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const yunwuAutoTestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const platoAutoTestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jijingAutoTestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningHubAutoTestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const xiaocheAutoTestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoNativeKeyRef = useRef('');
  const lastAutoYunwuKeyRef = useRef('');
  const lastAutoPlatoKeyRef = useRef('');
  const lastAutoJijingKeyRef = useRef('');
  const lastAutoRunningHubKeyRef = useRef('');
  const lastAutoXiaocheKeyRef = useRef('');

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

  const loadCacheStats = async () => {
    const stats = await storageService.getCacheStats();
    setCacheStats(stats);
  };

  useEffect(() => {
    if (!isOpen) return;
    setSettingsLoaded(false);

    // Load Agent Settings
    const savedName = localStorage.getItem('agentName');
    const savedRole = localStorage.getItem('agentRole');
    const savedCapabilities = localStorage.getItem('agentCapabilities');
    const savedTextApiProvider = localStorage.getItem('text_api_provider');
    if (savedName) setAgentName(savedName);
    if (savedRole) setAgentRole(savedRole);
    if (savedCapabilities) setAgentCapabilities(savedCapabilities);
    if (savedTextApiProvider === 'deepseek' || savedTextApiProvider === 'plato' || savedTextApiProvider === 'yunwu' || savedTextApiProvider === 'runninghub' || savedTextApiProvider === 'native') {
      setTextApiProvider(savedTextApiProvider);
    } else {
      setTextApiProvider('auto');
    }
    setDeepThinkingEnabled(getTextModelPowerMode() === 'deep-thinking');

    // Load Model Settings
    const savedNativeKey = localStorage.getItem('user_api_key');
    const savedNativeEnabled = localStorage.getItem('native_enabled');
    if (savedNativeKey) setNativeApiKey(savedNativeKey);
    lastAutoNativeKeyRef.current = savedNativeKey || '';
    setNativeEnabled(savedNativeEnabled !== 'false');

    setDeepSeekApiKey(localStorage.getItem('deepseek_api_key') || '');
    setDeepSeekBaseUrl(localStorage.getItem('deepseek_base_url') || DEFAULT_DEEPSEEK_BASE_URL);
    localStorage.setItem('deepseek_model', DEEPSEEK_AUTO_MODEL);
    const savedDeepSeekReasoning = localStorage.getItem('deepseek_reasoning_effort');
    setDeepSeekReasoning(
      savedDeepSeekReasoning === 'off'
      || savedDeepSeekReasoning === 'low'
      || savedDeepSeekReasoning === 'max'
        ? savedDeepSeekReasoning
        : 'high',
    );
    setDeepSeekEnabled(localStorage.getItem('deepseek_enabled') === 'true');

    const savedYunwuKey = localStorage.getItem('yunwu_api_key');
    const savedYunwuUrl = localStorage.getItem('yunwu_base_url');
    const savedModel = localStorage.getItem('yunwu_default_model');
    const savedYunwuEnabled = localStorage.getItem('yunwu_enabled');
    if (savedYunwuKey) setYunwuApiKey(savedYunwuKey);
    lastAutoYunwuKeyRef.current = savedYunwuKey || '';
    if (savedYunwuUrl) setYunwuBaseUrl(savedYunwuUrl);
    if (savedModel) setSelectedModel(savedModel);
    else setSelectedModel('gemini-3.1-flash-lite-preview');
    setYunwuEnabled(savedYunwuEnabled !== 'false');

    const savedPlatoKey = localStorage.getItem('plato_api_key');
    const savedPlatoUrl = localStorage.getItem('plato_base_url');
    const savedPlatoEnabled = localStorage.getItem('plato_enabled');
    if (savedPlatoKey) setPlatoApiKey(savedPlatoKey);
    lastAutoPlatoKeyRef.current = savedPlatoKey || '';
    setPlatoBaseUrl(savedPlatoUrl || DEFAULT_PLATO_BASE_URL);
    setPlatoEnabled(savedPlatoEnabled === 'true');

    const savedJijingKey = localStorage.getItem('jijing_api_key');
    const savedJijingUrl = localStorage.getItem('jijing_base_url');
    const savedJijingEnabled = localStorage.getItem('jijing_enabled');
    if (savedJijingKey) setJijingApiKey(savedJijingKey);
    lastAutoJijingKeyRef.current = savedJijingKey || '';
    if (savedJijingUrl) setJijingBaseUrl(savedJijingUrl === LEGACY_JIJING_BASE_URL ? DEFAULT_NO1_IMAGE_BASE_URL : savedJijingUrl);
    setJijingEnabled(savedJijingEnabled === 'true');

    const savedRunningHubKey = localStorage.getItem('runninghub_api_key');
    const savedRunningHubUrl = localStorage.getItem('runninghub_base_url');
    const savedRunningHubEnabled = localStorage.getItem('runninghub_enabled');
    if (savedRunningHubKey) setRunningHubApiKey(savedRunningHubKey);
    lastAutoRunningHubKeyRef.current = savedRunningHubKey || '';
    if (savedRunningHubUrl) setRunningHubBaseUrl(savedRunningHubUrl);
    setRunningHubEnabled(savedRunningHubEnabled === 'true');

    setQwenApiKey(localStorage.getItem('qwen_api_key') || '');
    setQwenEnabled(localStorage.getItem('qwen_enabled') === 'true');

    const savedVirseKey = localStorage.getItem('virse_api_key');
    const savedVirseEnabled = localStorage.getItem('virse_enabled');
    const savedVirseUrl = localStorage.getItem('virse_base_url');
    const effectiveVirseUrl = savedVirseUrl || DEFAULT_VIRSE_BASE_URL;
    setVirseApiKey(savedVirseKey || '');
    setVirseEnabled(savedVirseEnabled === 'true');
    setVirseBaseUrl(effectiveVirseUrl);
    setVirseWorkspaces([]);
    setVirseModels([]);
    setVirseTestStatus('idle');
    setVirseTestMessage('');
    setVirseSpaceId(localStorage.getItem('virse_space_id') || '');
    setVirseCanvasId(localStorage.getItem('virse_canvas_id') || '');
    setVirseModel(localStorage.getItem('virse_model') || 'nano-banana-2');

    const savedXiaocheKey = localStorage.getItem('xiaoche_api_key');
    const savedXiaocheUrl = localStorage.getItem('xiaoche_base_url');
    const savedXiaocheEnabled = localStorage.getItem('xiaoche_enabled');
    setXiaocheApiKey(savedXiaocheKey || '');
    lastAutoXiaocheKeyRef.current = savedXiaocheKey || '';
    setXiaocheBaseUrl(savedXiaocheUrl || DEFAULT_XIAOCHE_BASE_URL);
    setXiaocheEnabled(savedXiaocheEnabled === 'true');

    const savedVolcengineKey = localStorage.getItem('volcengine_api_key') || localStorage.getItem('seedance_api_key');
    const savedVolcengineEnabled = localStorage.getItem('seedance_enabled');
    if (savedVolcengineKey) setVolcengineApiKey(savedVolcengineKey);
    setVolcengineEnabled(savedVolcengineEnabled === 'true' || Boolean(savedVolcengineKey));

    const savedImageHostProvider = localStorage.getItem('image_host_provider');
    setImageHostProvider(savedImageHostProvider === 'none' ? 'none' : savedImageHostProvider === 'freeimage' ? 'freeimage' : 'imgbb');
    setImgbbApiKey(localStorage.getItem('imgbb_api_key') || '');
    setFreeimageApiKey(localStorage.getItem('freeimage_api_key') || '');
    setSettingsLoaded(true);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'cache') return;
    void loadCacheStats();
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (!isOpen) return;
    const handleAutoCleaned = (event: Event) => {
      const detail = (event as CustomEvent<{ deleted?: number; reason?: string }>).detail;
      const deleted = detail?.deleted || 0;
      if (deleted > 0 && detail?.reason === 'expired') {
        setCacheMessage(`已自动清理 ${deleted} 个超过 30 分钟的项目历史和生成图片缓存。`);
      } else if (deleted > 0) {
        setCacheMessage(`检测到缓存超过 2GB，已自动清理 ${deleted} 个较早项目，仅保留最近 50 个。`);
      }
      if (activeTab === 'cache') void loadCacheStats();
    };
    window.addEventListener('project-cache-auto-cleaned', handleAutoCleaned);
    return () => window.removeEventListener('project-cache-auto-cleaned', handleAutoCleaned);
  }, [isOpen, activeTab]);

  const runCacheCleanup = async (mode: 'older7' | 'older30' | 'keep50' | 'all') => {
    const confirmText = {
      older7: '确定清理 7 天前的项目历史吗？API Key 和当前配置不会被删除。',
      older30: '确定清理 30 天前的项目历史吗？API Key 和当前配置不会被删除。',
      keep50: '确定只保留最近 50 个项目吗？更早的项目历史会被删除。',
      all: '确定清空全部项目历史吗？生成记录和图片缓存会被删除，但 API Key 和模型配置会保留。',
    }[mode];

    if (!confirm(confirmText)) return;

    setCacheBusy(true);
    setCacheMessage('正在清理缓存...');
    try {
      let deleted = 0;
      const now = Date.now();
      if (mode === 'older7') deleted = await storageService.deleteProjectsOlderThan(now - 7 * 24 * 60 * 60 * 1000);
      if (mode === 'older30') deleted = await storageService.deleteProjectsOlderThan(now - 30 * 24 * 60 * 60 * 1000);
      if (mode === 'keep50') deleted = await storageService.keepLatestProjects(50);
      if (mode === 'all') {
        const before = await storageService.getCacheStats();
        await storageService.deleteAllProjects();
        await deleteFromStorage('assets');
        window.dispatchEvent(new Event('video-factory-assets-cleared'));
        deleted = before.projectCount;
      }
      await loadCacheStats();
      window.dispatchEvent(new Event('project-cache-updated'));
      setCacheMessage(`已清理 ${deleted} 个项目`);
    } catch (error: any) {
      setCacheMessage(`清理失败：${error?.message || '未知错误'}`);
    } finally {
      setCacheBusy(false);
    }
  };

  const handleSaveAll = () => {
    // Save Agent
    localStorage.setItem('agentName', agentName);
    localStorage.setItem('agentRole', agentRole);
    localStorage.setItem('agentCapabilities', agentCapabilities);
    localStorage.setItem('text_api_provider', textApiProvider);
    setTextModelPowerMode(deepThinkingEnabled ? 'deep-thinking' : 'low-power');

    // Save Model
    const trimmedNative = nativeApiKey.trim();
    localStorage.setItem('user_api_key', trimmedNative);
    localStorage.setItem('user_gemini_api_key', trimmedNative);
    localStorage.setItem('native_enabled', String(nativeEnabled));

    localStorage.setItem('deepseek_api_key', deepSeekApiKey.trim());
    localStorage.setItem('deepseek_base_url', deepSeekBaseUrl.trim() || DEFAULT_DEEPSEEK_BASE_URL);
    localStorage.setItem('deepseek_model', DEEPSEEK_AUTO_MODEL);
    localStorage.setItem('deepseek_reasoning_effort', deepSeekReasoning);
    localStorage.setItem('deepseek_enabled', String(deepSeekEnabled));
    localStorage.setItem('deepseek_harness_enabled', 'true');
    
    localStorage.setItem('yunwu_api_key', yunwuApiKey.trim());
    localStorage.setItem('yunwu_base_url', yunwuBaseUrl.trim() || DEFAULT_BASE_URL);
    localStorage.setItem('yunwu_default_model', selectedModel);
    localStorage.setItem('yunwu_enabled', String(yunwuEnabled));
    
    localStorage.setItem('plato_api_key', platoApiKey.trim());
    localStorage.setItem('plato_base_url', platoBaseUrl.trim() || DEFAULT_PLATO_BASE_URL);
    localStorage.setItem('plato_enabled', String(platoEnabled));

    localStorage.setItem('jijing_api_key', jijingApiKey.trim());
    localStorage.setItem('jijing_base_url', jijingBaseUrl.trim() || DEFAULT_NO1_IMAGE_BASE_URL);
    localStorage.setItem('jijing_enabled', String(jijingEnabled));

    localStorage.setItem('runninghub_api_key', runningHubApiKey.trim());
    localStorage.setItem('runninghub_base_url', runningHubBaseUrl.trim() || DEFAULT_RUNNINGHUB_BASE_URL);
    localStorage.setItem('runninghub_enabled', String(runningHubEnabled));

    localStorage.setItem('qwen_api_key', qwenApiKey.trim());
    localStorage.setItem('qwen_enabled', String(qwenEnabled));

    localStorage.setItem('virse_api_key', virseApiKey.trim());
    localStorage.setItem('virse_base_url', virseBaseUrl);
    localStorage.setItem('virse_enabled', String(virseEnabled));
    localStorage.setItem('virse_space_id', virseSpaceId);
    localStorage.setItem('virse_canvas_id', virseCanvasId);
    localStorage.setItem('virse_model', virseModel);

    localStorage.setItem('xiaoche_api_key', xiaocheApiKey.trim());
    localStorage.setItem('xiaoche_base_url', xiaocheBaseUrl.trim() || DEFAULT_XIAOCHE_BASE_URL);
    localStorage.setItem('xiaoche_enabled', String(xiaocheEnabled));
    localStorage.setItem('xiaoche_supported_models', JSON.stringify(XIAOCHE_MODELS));

    localStorage.setItem('volcengine_api_key', volcengineApiKey.trim());
    localStorage.setItem('seedance_api_key', volcengineApiKey.trim());
    localStorage.setItem('seedance_base_url', DEFAULT_VOLCENGINE_BASE_URL);
    localStorage.removeItem('seedance_model');
    localStorage.setItem('seedance_enabled', String(volcengineEnabled));

    localStorage.setItem('image_host_provider', imageHostProvider);
    localStorage.setItem('imgbb_api_key', imgbbApiKey.trim());
    localStorage.setItem('freeimage_api_key', freeimageApiKey.trim());

    window.dispatchEvent(new Event('agent-settings-updated'));
    window.dispatchEvent(new Event('api-settings-updated'));
    
    setTestStatus('success');
    setTestMessage('配置已保存');
    setTimeout(() => {
      setTestStatus('idle');
      onClose();
    }, 1000);
  };

  // --- Test Connection Handlers ---
  const handleTestDeepSeek = async () => {
    const key = deepSeekApiKey.split(/[,\n]/).map(item => item.trim()).find(Boolean);
    if (!DEEPSEEK_SERVER_MANAGED && !key) {
      setDeepSeekTestStatus('error');
      setDeepSeekTestMessage('请输入 DeepSeek API Key');
      return;
    }

    setDeepSeekTestStatus('testing');
    setDeepSeekTestMessage('正在连接 DeepSeek 原生 API...');
    try {
      const response = await testDeepSeekConnection({
        baseUrl: deepSeekBaseUrl.trim() || DEFAULT_DEEPSEEK_BASE_URL,
        apiKey: key || '',
      });
      setDeepSeekTestStatus('success');
      setDeepSeekTestMessage(response ? `连接成功：${response}` : '连接成功');
    } catch (error: unknown) {
      setDeepSeekTestStatus('error');
      setDeepSeekTestMessage(`连接失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleTestPlato = async () => {
    const key = platoApiKey.split(/[,\n]/).map(k => k.trim()).filter(k => k !== "")[0];
    if (!key) {
      setPlatoTestStatus('error');
      setPlatoTestMessage('请输入 API Key');
      return;
    }
    setPlatoTestStatus('testing');
    setPlatoTestMessage('正在测试...');
    try {
      const res = await sendTestRequest(platoBaseUrl.trim() || DEFAULT_PLATO_BASE_URL, key, 'gemini-3.1-flash-lite-preview', 'Say OK');
      setPlatoTestStatus(res.text ? 'success' : 'error');
      setPlatoTestMessage(res.text ? '✅ 连接成功' : '❌ 无响应');
    } catch (e: any) {
      setPlatoTestStatus('error');
      setPlatoTestMessage(`❌ ${e.message}`);
    }
  };

  const handleTestJijing = async () => {
    const key = jijingApiKey.split(/[,\n]/).map(k => k.trim()).filter(k => k !== "")[0];
    if (!key) {
      setJijingTestStatus('error');
      setJijingTestMessage('请输入 API Key');
      return;
    }
    setJijingTestStatus('testing');
    setJijingTestMessage('正在测试...');
    try {
      const res = await sendTestRequest(jijingBaseUrl || DEFAULT_NO1_IMAGE_BASE_URL, key, 'gemini-3.1-flash-lite-preview', 'Say OK');
      setJijingTestStatus(res.text ? 'success' : 'error');
      setJijingTestMessage(res.text ? '✅ 连接成功' : '❌ 无响应');
    } catch (e: any) {
      setJijingTestStatus('error');
      setJijingTestMessage(`❌ ${e.message}`);
    }
  };

  const handleTestRunningHub = async () => {
    const key = runningHubApiKey.split(/[,\n]/).map(k => k.trim()).filter(k => k !== "")[0];
    if (!key) {
      setRunningHubTestStatus('error');
      setRunningHubTestMessage('请输入 API Key');
      return;
    }
    setRunningHubTestStatus('testing');
    setRunningHubTestMessage('正在测试...');
    try {
      const baseUrl = (runningHubBaseUrl || DEFAULT_RUNNINGHUB_BASE_URL).replace(/\/+$/, '');
      let response = await fetch(`${baseUrl}/openapi/v2/query?taskId=ping`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${key}`,
        },
      });

      if (response.status === 401 || response.status === 403) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || errorData.msg || errorData.message || 'API Key 无效或未授权');
      }

      if (!response.ok && response.status === 404) {
        response = await fetch(`${baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: 'nano-banana-2',
            messages: [{ role: 'user', content: 'hi' }],
          }),
        });
        if (response.status === 401 || response.status === 403) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || errorData.msg || errorData.message || 'API Key 无效或未授权');
        }
      }

      setRunningHubTestStatus('success');
      setRunningHubTestMessage('连接成功');
    } catch (e: any) {
      setRunningHubTestStatus('error');
      setRunningHubTestMessage(e?.message || '连接失败');
    }
  };

  const handleTestQwen = async () => {
    const key = qwenApiKey.trim();
    if (!key) {
      setQwenTestStatus('error');
      setQwenTestMessage('请输入 API Key');
      return;
    }
    setQwenTestStatus('testing');
    setQwenTestMessage('正在测试...');
    try {
      const response = await fetch(QWEN_IMAGE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: 'qwen-image-3.0-pro',
          input: {
            messages: [{ role: 'user', content: [{ text: '一枚简洁的青色圆形图标，纯白背景' }] }],
          },
          parameters: { prompt_extend: true },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error?.message || data?.message || `HTTP Error ${response.status}`);
      }
      const image = data?.output?.choices?.[0]?.message?.content?.find?.((item: any) => item?.image)?.image;
      if (!image) throw new Error('接口未返回生成图片');
      setQwenTestStatus('success');
      setQwenTestMessage('连接成功');
    } catch (e: any) {
      setQwenTestStatus('error');
      setQwenTestMessage(e?.message || '连接失败');
    }
  };

  const handleTestVirse = async () => {
    const syncVersion = ++virseSyncVersion.current;
    const key = virseApiKey.trim();
    if (!key) {
      setVirseTestStatus('error');
      setVirseTestMessage('请输入 virse_sk_ 开头的 API Key');
      return;
    }
    setVirseTestStatus('testing');
    setVirseTestMessage('正在重新获取工作区并逐一核实画布...');
    setVirseWorkspaces([]);
    setVirseModels([]);
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

      // A successful Virse sync is immediately authoritative for image routing.
      // Do not wait for the modal-wide Save button, otherwise the visible toggle
      // and the provider read by image generation can disagree.
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

  // Refresh on opening settings, returning from Virse, and while this panel stays
  // visible. Never let a delayed refresh undo a manual sync or a new selection.
  useEffect(() => {
    const key = virseApiKey.trim();
    if (!isOpen || !settingsLoaded || !virseEnabled || !key || virseTestStatus === 'testing'
      || key !== localStorage.getItem('virse_api_key')?.trim()
      || virseBaseUrl !== (localStorage.getItem('virse_base_url') || DEFAULT_VIRSE_BASE_URL)) return;
    let disposed = false;
    let pending = false;
    const refresh = async () => {
      if (disposed || pending || document.visibilityState === 'hidden') return;
      pending = true;
      const version = virseSyncVersion.current;
      try {
        const [workspaces, models] = await Promise.all([
          listVirseWorkspaces(key, virseBaseUrl),
          listVirseImageModels(key, virseBaseUrl).catch(() => null),
        ]);
        if (disposed || version !== virseSyncVersion.current) return;
        setVirseWorkspaces(workspaces);
        if (models) {
          setVirseModels(models);
          localStorage.setItem('virse_image_models_cache', JSON.stringify(models));
        }
        const selected = findVirseWorkspace(workspaces, virseSpaceId, virseCanvasId);
        if (!selected && (virseSpaceId || virseCanvasId)) {
          setVirseSpaceId('');
          setVirseCanvasId('');
          // Do not erase a choice changed in another tab while the request ran.
          if (localStorage.getItem('virse_api_key')?.trim() === key
            && localStorage.getItem('virse_base_url') === virseBaseUrl
            && localStorage.getItem('virse_space_id') === virseSpaceId
            && localStorage.getItem('virse_canvas_id') === virseCanvasId) {
            localStorage.removeItem('virse_space_id');
            localStorage.removeItem('virse_canvas_id');
            window.dispatchEvent(new Event('api-settings-updated'));
          }
        }
        setVirseTestStatus('success');
        setVirseTestMessage(`已同步 · ${workspaces.length} 个可用画布${!selected && virseCanvasId ? ' · 已移除失效画布，请重新选择' : ''}`);
      } catch {
        if (disposed || version !== virseSyncVersion.current) return;
        setVirseWorkspaces([]);
        setVirseTestStatus('error');
        setVirseTestMessage('工作区同步失败，请重试；尚未确认当前画布是否有效。');
      } finally {
        pending = false;
      }
    };
    if (virseTestStatus === 'idle') void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 30000);
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [isOpen, settingsLoaded, virseEnabled, virseApiKey, virseBaseUrl, virseSpaceId, virseCanvasId, virseTestStatus]);

  const handleTestImgBb = async () => {
    const keys = imgbbApiKey.split(/[\n,;]+/).map((key) => key.trim()).filter(Boolean);
    if (keys.length === 0) {
      setImgbbTestStatus('error');
      setImgbbTestMessage('请至少填写一个 ImgBB API Key');
      return;
    }
    setImgbbTestStatus('testing');
    setImgbbTestMessage(`正在测试 ${keys.length} 个 Key...`);
    try {
      const response = await fetch('/api/virse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'test_imgbb', imgbbApiKey }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
      const total = Number(payload?.data?.total || keys.length);
      const valid = Number(payload?.data?.valid || 0);
      const invalid = Number(payload?.data?.invalid || total - valid);
      if (valid === 0) throw new Error(`0/${total} 个 Key 可用，请检查 Key 是否正确`);
      setImgbbTestStatus(invalid > 0 ? 'error' : 'success');
      setImgbbTestMessage(invalid > 0
        ? `${valid}/${total} 个 Key 可用，${invalid} 个无效；生成时会自动跳过无效 Key`
        : `连接成功：${valid}/${total} 个 Key 可用，已启用轮询`);
    } catch (error: any) {
      setImgbbTestStatus('error');
      setImgbbTestMessage(error?.message || 'ImgBB 测试连接失败');
    }
  };

  const handleTestFreeImage = async () => {
    const keys = freeimageApiKey.split(/[\n,;]+/).map((key) => key.trim()).filter(Boolean);
    if (keys.length === 0) {
      setFreeimageTestStatus('error');
      setFreeimageTestMessage('请至少填写一个 FreeImage.host API Key');
      return;
    }
    setFreeimageTestStatus('testing');
    setFreeimageTestMessage(`正在测试 ${keys.length} 个 Key...`);
    try {
      const response = await fetch('/api/virse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'test_freeimage', freeimageApiKey }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
      const total = Number(payload?.data?.total || keys.length);
      const valid = Number(payload?.data?.valid || 0);
      const invalid = Number(payload?.data?.invalid || total - valid);
      if (valid === 0) throw new Error(`0/${total} 个 Key 可用，请检查 Key 参数是否正确`);
      setFreeimageTestStatus(invalid > 0 ? 'error' : 'success');
      setFreeimageTestMessage(invalid > 0
        ? `${valid}/${total} 个 Key 可用，${invalid} 个无效；生成时会自动跳过无效 Key`
        : `连接成功：${valid}/${total} 个 Key 可用，已启用轮询`);
    } catch (error: any) {
      setFreeimageTestStatus('error');
      setFreeimageTestMessage(error?.message || 'FreeImage.host 测试连接失败');
    }
  };

  const handleTestXiaoche = async () => {
    const key = xiaocheApiKey.split(/[,\n]/).map(k => k.trim()).filter(Boolean)[0];
    if (!key) {
      setXiaocheTestStatus('error');
      setXiaocheTestMessage('请输入 API Key');
      return;
    }
    setXiaocheTestStatus('testing');
    setXiaocheTestMessage('正在检测本地中转...');
    try {
      const baseUrl = (xiaocheBaseUrl || DEFAULT_XIAOCHE_BASE_URL).replace(/\/+$/, '');
      const response = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || errorData?.message || `HTTP Error ${response.status}`);
      }
      setXiaocheTestStatus('success');
      setXiaocheTestMessage('连接成功');
    } catch (e: any) {
      setXiaocheTestStatus('error');
      setXiaocheTestMessage(e?.message || '连接失败，请确认本地 38000 端口服务已启动');
    }
  };

  const handleTestYunwu = async () => {
    const key = yunwuApiKey.split(/[,\n]/).map(k => k.trim()).filter(k => k !== "")[0];
    if (!key) {
      setYunwuTestStatus('error');
      setYunwuTestMessage('请输入 API Key');
      return;
    }
    setYunwuTestStatus('testing');
    setYunwuTestMessage('正在测试...');
    try {
      // 使用固定模型进行测试，不依赖用户选择的模型
      const testModel = resolveRuntimeModelId('gemini-3.1-flash-lite-preview', { isYunwu: true, isPlato: false });
      const res = await sendTestRequest(yunwuBaseUrl || DEFAULT_BASE_URL, key, testModel, 'Say OK');
      setYunwuTestStatus(res.text ? 'success' : 'error');
      setYunwuTestMessage(res.text ? '✅ 连接成功' : '❌ 无响应');
    } catch (e: any) {
      setYunwuTestStatus('error');
      setYunwuTestMessage(`❌ ${e.message}`);
    }
  };

  const handleTestNative = async () => {
    if (!nativeApiKey.trim()) {
      setNativeTestStatus('error');
      setNativeTestMessage('请输入 API Key');
      return;
    }
    setNativeTestStatus('testing');
    setNativeTestMessage('正在测试...');
    try {
      const res = await sendTestRequest('https://generativelanguage.googleapis.com', nativeApiKey.trim(), 'gemini-3.1-flash-lite-preview', 'Say OK');
      setNativeTestStatus(res.text ? 'success' : 'error');
      setNativeTestMessage(res.text ? '✅ 连接成功' : '❌ 无响应');
    } catch (e: any) {
      setNativeTestStatus('error');
      setNativeTestMessage(`❌ ${e.message}`);
    }
  };

  const handleTestVolcengine = async () => {
    const key = volcengineApiKey.trim();
    if (!key) {
      setVolcengineTestStatus('error');
      setVolcengineTestMessage('请输入火山方舟 API Key');
      return;
    }
    setVolcengineTestStatus('testing');
    setVolcengineTestMessage('正在验证火山方舟配置...');
    try {
      await testVolcengineConnection(
        DEFAULT_VOLCENGINE_BASE_URL,
        key
      );
      setVolcengineTestStatus('success');
      setVolcengineTestMessage('连接成功，可使用火山方舟模型');
    } catch (e: any) {
      setVolcengineTestStatus('error');
      setVolcengineTestMessage(e?.message || '连接失败');
    }
  };

  useEffect(() => {
    if (!isOpen || !settingsLoaded || !nativeEnabled) return;
    const key = nativeApiKey.trim();
    if (key === lastAutoNativeKeyRef.current) return;
    if (nativeAutoTestTimerRef.current) clearTimeout(nativeAutoTestTimerRef.current);
    lastAutoNativeKeyRef.current = key;
    if (!key) {
      setNativeTestStatus('idle');
      setNativeTestMessage('');
      return;
    }
    setNativeTestStatus('testing');
    setNativeTestMessage('输入已更新，正在自动测试...');
    nativeAutoTestTimerRef.current = setTimeout(() => {
      void handleTestNative();
    }, 900);
    return () => {
      if (nativeAutoTestTimerRef.current) clearTimeout(nativeAutoTestTimerRef.current);
    };
  }, [nativeApiKey, nativeEnabled, isOpen, settingsLoaded]);

  useEffect(() => {
    if (!isOpen || !settingsLoaded || !yunwuEnabled) return;
    const key = yunwuApiKey.trim();
    if (key === lastAutoYunwuKeyRef.current) return;
    if (yunwuAutoTestTimerRef.current) clearTimeout(yunwuAutoTestTimerRef.current);
    lastAutoYunwuKeyRef.current = key;
    if (!key) {
      setYunwuTestStatus('idle');
      setYunwuTestMessage('');
      return;
    }
    setYunwuTestStatus('testing');
    setYunwuTestMessage('输入已更新，正在自动测试...');
    yunwuAutoTestTimerRef.current = setTimeout(() => {
      void handleTestYunwu();
    }, 900);
    return () => {
      if (yunwuAutoTestTimerRef.current) clearTimeout(yunwuAutoTestTimerRef.current);
    };
  }, [yunwuApiKey, yunwuEnabled, isOpen, settingsLoaded]);

  useEffect(() => {
    if (!isOpen || !settingsLoaded || !platoEnabled) return;
    const key = platoApiKey.trim();
    if (key === lastAutoPlatoKeyRef.current) return;
    if (platoAutoTestTimerRef.current) clearTimeout(platoAutoTestTimerRef.current);
    lastAutoPlatoKeyRef.current = key;
    if (!key) {
      setPlatoTestStatus('idle');
      setPlatoTestMessage('');
      return;
    }
    setPlatoTestStatus('testing');
    setPlatoTestMessage('输入已更新，正在自动测试...');
    platoAutoTestTimerRef.current = setTimeout(() => {
      void handleTestPlato();
    }, 900);
    return () => {
      if (platoAutoTestTimerRef.current) clearTimeout(platoAutoTestTimerRef.current);
    };
  }, [platoApiKey, platoBaseUrl, platoEnabled, isOpen, settingsLoaded]);

  useEffect(() => {
    if (!isOpen || !settingsLoaded || !jijingEnabled) return;
    const key = jijingApiKey.trim();
    if (key === lastAutoJijingKeyRef.current) return;
    if (jijingAutoTestTimerRef.current) clearTimeout(jijingAutoTestTimerRef.current);
    lastAutoJijingKeyRef.current = key;
    if (!key) {
      setJijingTestStatus('idle');
      setJijingTestMessage('');
      return;
    }
    setJijingTestStatus('testing');
    setJijingTestMessage('输入已更新，正在自动测试...');
    jijingAutoTestTimerRef.current = setTimeout(() => {
      void handleTestJijing();
    }, 900);
    return () => {
      if (jijingAutoTestTimerRef.current) clearTimeout(jijingAutoTestTimerRef.current);
    };
  }, [jijingApiKey, jijingEnabled, isOpen, settingsLoaded]);

  useEffect(() => {
    if (!isOpen || !settingsLoaded || !runningHubEnabled) return;
    const key = runningHubApiKey.trim();
    if (key === lastAutoRunningHubKeyRef.current) return;
    if (runningHubAutoTestTimerRef.current) clearTimeout(runningHubAutoTestTimerRef.current);
    lastAutoRunningHubKeyRef.current = key;
    if (!key) {
      setRunningHubTestStatus('idle');
      setRunningHubTestMessage('');
      return;
    }
    setRunningHubTestStatus('testing');
    setRunningHubTestMessage('输入已更新，正在自动测试...');
    runningHubAutoTestTimerRef.current = setTimeout(() => {
      void handleTestRunningHub();
    }, 900);
    return () => {
      if (runningHubAutoTestTimerRef.current) clearTimeout(runningHubAutoTestTimerRef.current);
    };
  }, [runningHubApiKey, runningHubEnabled, isOpen, settingsLoaded]);

  useEffect(() => {
    if (!isOpen || !settingsLoaded || !xiaocheEnabled) return;
    const key = xiaocheApiKey.trim();
    if (key === lastAutoXiaocheKeyRef.current) return;
    if (xiaocheAutoTestTimerRef.current) clearTimeout(xiaocheAutoTestTimerRef.current);
    lastAutoXiaocheKeyRef.current = key;
    if (!key) {
      setXiaocheTestStatus('idle');
      setXiaocheTestMessage('');
      return;
    }
    setXiaocheTestStatus('testing');
    setXiaocheTestMessage('输入已更新，正在自动测试...');
    xiaocheAutoTestTimerRef.current = setTimeout(() => void handleTestXiaoche(), 900);
    return () => {
      if (xiaocheAutoTestTimerRef.current) clearTimeout(xiaocheAutoTestTimerRef.current);
    };
  }, [xiaocheApiKey, xiaocheBaseUrl, xiaocheEnabled, isOpen, settingsLoaded]);

  const activeTitle = activeTab === 'model'
    ? '模型配置'
    : activeTab === 'agent'
      ? '智能体设定'
      : activeTab === 'cache'
        ? '缓存磁盘'
        : '图床服务';
  const activeSubtitle = activeTab === 'model'
    ? '配置 API 中转站与模型参数'
    : activeTab === 'agent'
      ? '定义智能体的角色、身份与核心能力'
      : activeTab === 'cache'
        ? '管理本地项目历史与浏览器存储占用'
        : '配置参考图片的临时公网存储服务';

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-7xl h-[92vh] bg-white dark:bg-[#121212] rounded-[2rem] shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden flex flex-col md:flex-row"
        >
          {/* Sidebar */}
          <div className="w-full md:w-72 bg-gray-50/50 dark:bg-black/20 border-r border-gray-200 dark:border-white/5 p-7 flex flex-col gap-3 shrink-0">
            <div className="flex items-center gap-3 mb-8 px-2">
              <div className="w-12 h-12 rounded-2xl bg-brand-orange flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="font-black text-lg text-gray-900 dark:text-white leading-tight">全局设置</h2>
                <p className="text-xs text-gray-500">XcAI Agent Settings</p>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('model')}
              className={`flex items-center gap-3 px-5 py-4 rounded-2xl transition-all ${activeTab === 'model' ? 'bg-white dark:bg-white/10 shadow-md text-brand-orange' : 'text-gray-500 hover:bg-gray-200/50 dark:hover:bg-white/5'}`}
            >
              <Cpu className="w-5 h-5" />
              <span className="text-sm font-bold">模型配置</span>
            </button>

            <button
              onClick={() => setActiveTab('agent')}
              className={`flex items-center gap-3 px-5 py-4 rounded-2xl transition-all ${activeTab === 'agent' ? 'bg-white dark:bg-white/10 shadow-md text-brand-orange' : 'text-gray-500 hover:bg-gray-200/50 dark:hover:bg-white/5'}`}
            >
              <Bot className="w-5 h-5" />
              <span className="text-sm font-bold">智能体设定</span>
            </button>

            <button
              onClick={() => setActiveTab('cache')}
              className={`flex items-center gap-3 px-5 py-4 rounded-2xl transition-all ${activeTab === 'cache' ? 'bg-white dark:bg-white/10 shadow-md text-brand-orange' : 'text-gray-500 hover:bg-gray-200/50 dark:hover:bg-white/5'}`}
            >
              <HardDrive className="w-5 h-5" />
              <span className="text-sm font-bold">缓存磁盘</span>
            </button>

            <button
              onClick={() => setActiveTab('image-host')}
              className={`flex items-center gap-3 px-5 py-4 rounded-2xl transition-all ${activeTab === 'image-host' ? 'bg-white dark:bg-white/10 shadow-md text-brand-orange' : 'text-gray-500 hover:bg-gray-200/50 dark:hover:bg-white/5'}`}
            >
              <ImageIcon className="w-5 h-5" />
              <span className="text-sm font-bold">图床服务</span>
            </button>

            <div className="mt-auto pt-6 border-t border-gray-200 dark:border-white/5">
              <button
                onClick={onClose}
                className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-gray-400 hover:text-gray-600 dark:hover:text-white transition-all text-sm font-medium"
              >
                <X className="w-5 h-5" />
                返回主页
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-8 lg:p-10 border-b border-gray-100 dark:border-white/5 flex items-center justify-between gap-6">
              <div>
                <h3 className="text-3xl font-black text-gray-900 dark:text-white">{activeTitle}</h3>
                <p className="text-base text-gray-500 mt-2">{activeSubtitle}</p>
              </div>
              <div className="hidden sm:flex items-center gap-3">
                 {activeTab === 'model' && (
                   <button
                     onClick={() => setShowUsageGuide(true)}
                     className="flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-white/5 text-gray-600 dark:text-gray-300 text-xs font-bold border border-gray-200 dark:border-white/10 hover:text-brand-orange hover:border-orange-200 transition-all"
                   >
                     <HelpCircle className="w-4 h-4" />
                     使用说明
                   </button>
                 )}
                 <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-orange-50 dark:bg-orange-500/10 text-brand-orange text-xs font-bold border border-orange-100 dark:border-orange-500/20">
                    <Sparkles className="w-3 h-3" />
                    AI Powered
                 </div>
              </div>
            </div>

            {/* Scrollable Area */}
            <div className="flex-1 overflow-y-auto p-8 lg:p-10 custom-scrollbar">
              {activeTab === 'model' ? (
                <div className="space-y-8 max-w-4xl">
                  {/* DeepSeek native API powers text/Agent execution only; media routing stays independent. */}
                  <div className={`p-5 sm:p-7 lg:p-8 rounded-3xl border transition-all ${deepSeekEnabled ? 'bg-white dark:bg-white/5 border-blue-300 dark:border-blue-500/40 shadow-sm' : 'bg-gray-50/50 dark:bg-black/20 border-gray-200 dark:border-white/5 opacity-80'}`}>
                    <div className="flex items-start justify-between gap-4 mb-6">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-3 rounded-2xl shrink-0 ${deepSeekEnabled ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' : 'bg-gray-200 text-gray-500'}`}>
                          <Bot className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                          <h4 className={`text-lg font-black ${deepSeekEnabled ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>DeepSeek 原生 API</h4>
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={deepSeekEnabled}
                        aria-label={deepSeekEnabled ? '关闭 DeepSeek 原生 API' : '开启 DeepSeek 原生 API'}
                        onClick={() => {
                          const enabled = !deepSeekEnabled;
                          setDeepSeekEnabled(enabled);
                          setTextApiProvider(enabled ? 'deepseek' : textApiProvider === 'deepseek' ? 'auto' : textApiProvider);
                        }}
                        className={`relative w-12 h-7 min-w-12 rounded-full transition-colors focus:outline-none focus:ring-4 focus:ring-blue-500/15 ${deepSeekEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-white/15'}`}
                      >
                        <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${deepSeekEnabled ? 'left-6' : 'left-1'}`} />
                      </button>
                    </div>

                    {deepSeekEnabled && (
                      <div className="space-y-5 animate-in fade-in slide-in-from-top-2">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <label className="text-sm font-bold text-gray-500 flex items-center gap-2"><Cpu className="w-4 h-4" /> 智能模型调度</label>
                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">AUTO</span>
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <div className="min-h-16 rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-3 dark:border-blue-500/20 dark:bg-blue-500/10">
                              <span className="block text-sm font-black text-blue-900 dark:text-blue-200">日常响应</span>
                              <span className="mt-1 block font-mono text-[10px] leading-4 text-blue-600 dark:text-blue-300">{DEEPSEEK_FLASH_MODEL}</span>
                            </div>
                            <div className="min-h-16 rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-3 dark:border-blue-500/20 dark:bg-blue-500/10">
                              <span className="block text-sm font-black text-blue-900 dark:text-blue-200">图片理解</span>
                              <span className="mt-1 block text-[10px] leading-4 text-blue-600 dark:text-blue-300">4.1 Flash 原生视觉</span>
                            </div>
                            <div className="min-h-16 rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-3 dark:border-blue-500/20 dark:bg-blue-500/10">
                              <span className="block text-sm font-black text-blue-900 dark:text-blue-200">复杂任务与工具</span>
                              <span className="mt-1 block font-mono text-[10px] leading-4 text-blue-600 dark:text-blue-300">{DEEPSEEK_PRO_MODEL}</span>
                            </div>
                          </div>
                          <p className="text-[11px] leading-5 text-gray-400">无需手动选择，Agent 会根据图片、任务复杂度和工具调用自动路由。</p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-bold text-gray-500 flex items-center gap-2"><Key className="w-4 h-4" /> DeepSeek API Key</label>
                          <div className="relative">
                            <input
                              type={isDeepSeekKeyVisible ? 'text' : 'password'}
                              value={deepSeekApiKey}
                              onChange={(event) => setDeepSeekApiKey(event.target.value)}
                              className="min-h-12 w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-5 pr-12 text-base focus:ring-2 focus:ring-blue-500/20 outline-none font-mono"
                              placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                              autoComplete="off"
                            />
                            <button
                              type="button"
                              aria-label={isDeepSeekKeyVisible ? '隐藏 DeepSeek API Key' : '显示 DeepSeek API Key'}
                              onClick={() => setIsDeepSeekKeyVisible(!isDeepSeekKeyVisible)}
                              className="absolute right-1 top-0 min-w-11 min-h-12 flex items-center justify-center text-gray-400 hover:text-blue-600"
                            >
                              {isDeepSeekKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-h-5 flex-1">
                            {deepSeekTestStatus !== 'idle' && (
                              <span
                                role="status"
                                className={`text-xs font-bold break-all ${deepSeekTestStatus === 'success' ? 'text-green-600' : deepSeekTestStatus === 'testing' ? 'text-blue-600' : 'text-red-500'}`}
                              >
                                {deepSeekTestMessage}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={handleTestDeepSeek}
                            disabled={deepSeekTestStatus === 'testing'}
                            className="min-h-11 shrink-0 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60 flex items-center justify-center gap-2"
                          >
                            {deepSeekTestStatus === 'testing' && <RefreshCw className="w-4 h-4 animate-spin" />}
                            {deepSeekTestStatus === 'testing' ? '测试中...' : '测试连接'}
                          </button>
                        </div>

                      </div>
                    )}
                  </div>

                  {/* Xiaoche relay — independent config keys prevent cross-provider overrides. */}
                  <div className={`p-5 sm:p-7 lg:p-8 rounded-3xl border transition-all ${xiaocheEnabled ? 'bg-white dark:bg-white/5 border-cyan-200 dark:border-cyan-500/30' : 'bg-gray-50/50 dark:bg-black/20 border-gray-200 dark:border-white/5 opacity-80'}`}>
                    <div className="flex items-start justify-between gap-4 mb-6">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-3 rounded-2xl shrink-0 ${xiaocheEnabled ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-200 text-gray-500'}`}>
                          <Sparkles className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className={`text-lg font-black ${xiaocheEnabled ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>小彻中转</h4>
                            <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-black text-cyan-700 border border-cyan-100">本地</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">独立配置 · {XIAOCHE_IMAGE_MODELS.length} 个生图模型 · {XIAOCHE_VIDEO_MODELS.length} 个视频模型</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label={xiaocheEnabled ? '关闭小彻中转' : '开启小彻中转'}
                        onClick={() => setXiaocheEnabled(!xiaocheEnabled)}
                        className={`relative w-12 h-7 min-w-12 rounded-full transition-colors ${xiaocheEnabled ? 'bg-cyan-600' : 'bg-gray-300'}`}
                      >
                        <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${xiaocheEnabled ? 'left-6' : 'left-1'}`} />
                      </button>
                    </div>

                    {xiaocheEnabled && (
                      <div className="space-y-5 animate-in fade-in slide-in-from-top-2">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-gray-500 flex items-center gap-2"><Globe className="w-4 h-4" /> Base URL</label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              value={xiaocheBaseUrl}
                              onChange={(e) => setXiaocheBaseUrl(e.target.value)}
                              className="min-h-11 flex-1 min-w-0 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 text-sm font-mono outline-none focus:ring-2 focus:ring-cyan-500/20"
                              placeholder={DEFAULT_XIAOCHE_BASE_URL}
                            />
                            <button
                              type="button"
                              onClick={() => setXiaocheBaseUrl(DEFAULT_XIAOCHE_BASE_URL)}
                              className="min-h-11 px-4 rounded-xl border border-cyan-200 bg-cyan-50 text-cyan-700 text-xs font-bold hover:bg-cyan-100 transition-colors"
                            >
                              恢复默认
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-bold text-gray-500 flex items-center gap-2"><Key className="w-4 h-4" /> API Key</label>
                          <div className="relative">
                            <textarea
                              value={xiaocheApiKey}
                              onChange={(e) => setXiaocheApiKey(e.target.value)}
                              rows={3}
                              style={{ WebkitTextSecurity: isXiaocheKeyVisible ? 'none' : 'disc' } as React.CSSProperties}
                              className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-5 py-4 pr-12 text-base focus:ring-2 focus:ring-cyan-500/20 outline-none font-mono resize-none"
                              placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                            />
                            <button type="button" aria-label="显示或隐藏 API Key" onClick={() => setIsXiaocheKeyVisible(!isXiaocheKeyVisible)} className="absolute right-2 top-2 min-w-11 min-h-11 flex items-center justify-center text-gray-400">
                              {isXiaocheKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <p className="text-xs text-gray-500">支持多个 Key（逗号或换行分隔）；配置仅保存在小彻中转专属字段中。</p>
                        </div>

                        <details className="group rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50/70 dark:bg-white/5">
                          <summary className="min-h-11 cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3 text-sm font-bold text-gray-600 dark:text-white/70">
                            <span>已接入模型清单（{XIAOCHE_MODELS.length}）</span>
                            <span className="text-xs text-cyan-700 group-open:rotate-180 transition-transform">⌄</span>
                          </summary>
                          <div className="max-h-56 overflow-y-auto border-t border-gray-200 dark:border-white/10 p-3 custom-scrollbar">
                            <p className="px-2 pb-2 text-[11px] font-black uppercase tracking-wider text-cyan-700">图片模型</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                              {XIAOCHE_IMAGE_MODELS.map(model => <code key={model} className="rounded-lg bg-white dark:bg-black/20 px-2.5 py-2 text-[11px] text-gray-600 dark:text-white/60 break-all">{model}</code>)}
                            </div>
                            <p className="px-2 pb-2 pt-4 text-[11px] font-black uppercase tracking-wider text-cyan-700">视频模型</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                              {XIAOCHE_VIDEO_MODELS.map(model => <code key={model} className="rounded-lg bg-white dark:bg-black/20 px-2.5 py-2 text-[11px] text-gray-600 dark:text-white/60 break-all">{model}</code>)}
                            </div>
                          </div>
                        </details>

                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="min-h-5 flex-1">
                            {xiaocheTestStatus !== 'idle' && (
                              <span className={`text-xs font-bold break-all ${xiaocheTestStatus === 'success' ? 'text-green-600' : xiaocheTestStatus === 'testing' ? 'text-blue-600' : 'text-red-500'}`}>
                                {xiaocheTestStatus === 'testing' ? '正在测试连接...' : xiaocheTestMessage}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={handleTestXiaoche}
                            disabled={xiaocheTestStatus === 'testing'}
                            className="min-h-11 px-5 rounded-xl bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
                          >
                            {xiaocheTestStatus === 'testing' && <RefreshCw className="w-4 h-4 animate-spin" />}
                            测试连接
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Volcengine Ark Config */}
                  <div className={`p-7 lg:p-8 rounded-3xl border transition-all ${volcengineEnabled ? 'bg-white dark:bg-white/5 border-orange-300 dark:border-orange-500/40' : 'bg-gray-50/50 dark:bg-black/20 border-gray-200 dark:border-white/5 opacity-80'}`}>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-2xl ${volcengineEnabled ? 'bg-orange-100 text-orange-600' : 'bg-gray-200 text-gray-500'}`}>
                          <Cloud className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className={`text-lg font-black ${volcengineEnabled ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>火山引擎方舟</h4>
                          <p className="text-xs text-gray-500 mt-0.5">配置一次 API Key，即可供工作站中的火山方舟模型共用</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setVolcengineEnabled(!volcengineEnabled)}
                        className={`relative w-12 h-6 rounded-full transition-colors ${volcengineEnabled ? 'bg-orange-500' : 'bg-gray-300'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${volcengineEnabled ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>

                    {volcengineEnabled && (
                      <div className="space-y-5 animate-in fade-in slide-in-from-top-2">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-gray-500 flex items-center gap-2"><Key className="w-4 h-4" /> Ark API Key</label>
                          <div className="relative">
                            <textarea
                              value={volcengineApiKey}
                              onChange={(e) => setVolcengineApiKey(e.target.value)}
                              rows={3}
                              style={{ WebkitTextSecurity: isVolcengineKeyVisible ? 'none' : 'disc' } as React.CSSProperties}
                              className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-5 py-4 text-base focus:ring-2 focus:ring-orange-500/20 outline-none font-mono resize-none"
                              placeholder="输入火山方舟 API Key"
                            />
                            <button onClick={() => setIsVolcengineKeyVisible(!isVolcengineKeyVisible)} className="absolute right-3 top-3 text-gray-400">
                              {isVolcengineKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <p className="text-[10px] text-gray-500">模型 ID 由工作站中的模型选择器自动传入，无需在此单独配置。</p>
                        </div>

                        <div className="flex items-center justify-between gap-4 mt-2">
                          <div className="flex-1">
                            {volcengineTestStatus !== 'idle' && (
                              <span className={`text-xs font-bold ${volcengineTestStatus === 'success' ? 'text-green-500' : volcengineTestStatus === 'testing' ? 'text-blue-500' : 'text-red-500'}`}>
                                {volcengineTestStatus === 'testing' ? '正在测试连接...' : volcengineTestMessage}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={handleTestVolcengine}
                            disabled={volcengineTestStatus === 'testing'}
                            className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-orange-50 dark:hover:bg-orange-500/10 text-gray-500 hover:text-orange-600 text-sm font-bold transition-all border border-gray-200 dark:border-white/10 min-w-[104px] flex items-center justify-center"
                          >
                            {volcengineTestStatus === 'testing' ? <RefreshCw className="w-3 h-3 animate-spin" /> : '测试连接'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Plato Config */}
                  <div className={`p-7 lg:p-8 rounded-3xl border transition-all ${platoEnabled ? 'bg-white dark:bg-white/5 border-rose-200 dark:border-rose-500/30' : 'bg-gray-50/50 dark:bg-black/20 border-gray-200 dark:border-white/5 opacity-80'}`}>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-2xl ${platoEnabled ? 'bg-rose-100 text-rose-600' : 'bg-gray-200 text-gray-500'}`}>
                          <Zap className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className={`text-lg font-black ${platoEnabled ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>柏拉图 API 中转站</h4>
                          <p className="text-xs text-gray-500 mt-0.5">高性能多节点 Gemini 中转服务</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setPlatoEnabled(!platoEnabled)}
                        className={`relative w-12 h-6 rounded-full transition-colors ${platoEnabled ? 'bg-rose-500' : 'bg-gray-300'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${platoEnabled ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>

                    {platoEnabled && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="space-y-2.5">
                          <label className="text-sm font-bold text-gray-500 flex items-center gap-2">
                            <Globe className="w-4 h-4" /> API 节点选择
                          </label>
                          <button
                            type="button"
                            onClick={() => setPlatoBaseUrl(DEFAULT_PLATO_BASE_URL)}
                            className="rounded-full border border-orange-300 bg-orange-50 px-4 py-2 text-xs font-bold text-orange-600 shadow-sm transition hover:border-orange-400 hover:bg-orange-100 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-300"
                            aria-pressed="true"
                          >
                            主站节点
                          </button>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-gray-500 flex items-center gap-2"><Key className="w-4 h-4" /> API Key</label>
                          <div className="relative">
                            <textarea
                              value={platoApiKey}
                              onChange={(e) => setPlatoApiKey(e.target.value)}
                              rows={4}
                              style={{ WebkitTextSecurity: isPlatoKeyVisible ? 'none' : 'disc' } as React.CSSProperties}
                              className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-5 py-4 text-base focus:ring-2 focus:ring-rose-500/20 outline-none font-mono resize-none"
                              placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                            />
                            <button onClick={() => setIsPlatoKeyVisible(!isPlatoKeyVisible)} className="absolute right-3 top-3 text-gray-400">
                              {isPlatoKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-4 mt-2">
                           <div className="flex-1">
                             {platoTestStatus !== 'idle' && (
                                <span className={`text-xs font-bold ${platoTestStatus === 'success' ? 'text-green-500' : platoTestStatus === 'testing' ? 'text-blue-500' : 'text-red-500'}`}>
                                 {platoTestStatus === 'success' ? '连接成功' : platoTestStatus === 'testing' ? '正在自动测试...' : platoTestMessage}
                               </span>
                             )}
                           </div>
                           <button
                             onClick={handleTestPlato}
                             disabled={platoTestStatus === 'testing'}
                             className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-gray-500 hover:text-rose-600 text-sm font-bold transition-all border border-gray-200 dark:border-white/10 min-w-[104px] flex items-center justify-center"
                           >
                             {platoTestStatus === 'testing' ? <RefreshCw className="w-3 h-3 animate-spin" /> : '测试连接'}
                           </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Qwen AI Platform */}
                  <div className={`p-7 lg:p-8 rounded-3xl border transition-all ${qwenEnabled ? 'bg-white dark:bg-white/5 border-cyan-200 dark:border-cyan-500/30' : 'bg-gray-50/50 dark:bg-black/20 border-gray-200 dark:border-white/5 opacity-80'}`}>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-2xl ${qwenEnabled ? 'bg-cyan-100 text-cyan-600' : 'bg-gray-200 text-gray-500'}`}>
                          <MessageCircle className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className={`text-lg font-black ${qwenEnabled ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>千问 AI 平台</h4>
                            <span className="px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700 text-[10px] font-black">千问3.0pro</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">官方 DashScope 图像接口，为创意中心提供图像生成与编辑</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setQwenEnabled(!qwenEnabled)}
                        className={`relative w-12 h-6 rounded-full transition-colors ${qwenEnabled ? 'bg-cyan-500' : 'bg-gray-300'}`}
                        aria-label={qwenEnabled ? '关闭千问 AI 平台' : '开启千问 AI 平台'}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${qwenEnabled ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>

                    {qwenEnabled && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-gray-500 flex items-center gap-2"><Key className="w-4 h-4" /> API Key</label>
                          <div className="relative">
                            <input
                              type={isQwenKeyVisible ? 'text' : 'password'}
                              value={qwenApiKey}
                              onChange={(e) => setQwenApiKey(e.target.value)}
                              className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-5 py-3 pr-12 text-sm focus:ring-2 focus:ring-cyan-500/20 outline-none font-mono"
                              placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                            />
                            <button onClick={() => setIsQwenKeyVisible(!isQwenKeyVisible)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" aria-label="显示或隐藏千问 API Key">
                              {isQwenKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-4 pt-1">
                          <div className="flex-1">
                            {qwenTestStatus !== 'idle' && (
                              <span className={`text-xs font-bold ${qwenTestStatus === 'success' ? 'text-green-500' : qwenTestStatus === 'testing' ? 'text-blue-500' : 'text-red-500'}`}>
                                {qwenTestStatus === 'testing' ? '正在测试...' : qwenTestMessage}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={handleTestQwen}
                            disabled={qwenTestStatus === 'testing'}
                            className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 text-gray-500 hover:text-cyan-600 text-sm font-bold transition-all border border-gray-200 dark:border-white/10 min-w-[104px] flex items-center justify-center"
                          >
                            {qwenTestStatus === 'testing' ? <RefreshCw className="w-3 h-3 animate-spin" /> : '测试连接'}
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-500">测试连接会调用千问3.0pro生成一张小型测试图，可能产生少量费用。</p>
                      </div>
                    )}
                  </div>

                  {/* RunningHub Config */}
                  <div className={`p-7 lg:p-8 rounded-3xl border transition-all ${runningHubEnabled ? 'bg-white dark:bg-white/5 border-amber-200 dark:border-amber-500/30' : 'bg-gray-50/50 dark:bg-black/20 border-gray-200 dark:border-white/5 opacity-80'}`}>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-2xl ${runningHubEnabled ? 'bg-amber-100 text-amber-600' : 'bg-gray-200 text-gray-500'}`}>
                          <Sparkles className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className={`text-lg font-black ${runningHubEnabled ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>RunningHub API 中转站</h4>
                          <p className="text-xs text-gray-500 mt-0.5">RunningHub 开放平台接口，支持 AI 图像与大模型调用</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setRunningHubEnabled(!runningHubEnabled)}
                        className={`relative w-12 h-6 rounded-full transition-colors ${runningHubEnabled ? 'bg-amber-500' : 'bg-gray-300'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${runningHubEnabled ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>

                    {runningHubEnabled && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-gray-500 flex items-center gap-2"><Globe className="w-4 h-4" /> API 节点地址</label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            <button
                              onClick={() => setRunningHubBaseUrl(DEFAULT_RUNNINGHUB_BASE_URL)}
                              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${runningHubBaseUrl === DEFAULT_RUNNINGHUB_BASE_URL ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500'}`}
                            >
                              RunningHub 官方主站
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-gray-500 flex items-center gap-2"><Key className="w-4 h-4" /> API Key</label>
                          <div className="relative">
                            <textarea
                              value={runningHubApiKey}
                              onChange={(e) => setRunningHubApiKey(e.target.value)}
                              rows={4}
                              style={{ WebkitTextSecurity: isRunningHubKeyVisible ? 'none' : 'disc' } as React.CSSProperties}
                              className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-5 py-4 text-base focus:ring-2 focus:ring-amber-500/20 outline-none font-mono resize-none"
                              placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                            />
                            <button onClick={() => setIsRunningHubKeyVisible(!isRunningHubKeyVisible)} className="absolute right-3 top-3 text-gray-400">
                              {isRunningHubKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <p className="text-[10px] text-gray-500">支持多 Key 轮询，请使用逗号或换行分隔。</p>
                        </div>
                        <div className="flex items-center justify-between gap-4 mt-2">
                           <div className="flex-1">
                             {runningHubTestStatus !== 'idle' && (
                                <span className={`text-xs font-bold ${runningHubTestStatus === 'success' ? 'text-green-500' : runningHubTestStatus === 'testing' ? 'text-blue-500' : 'text-red-500'}`}>
                                  {runningHubTestStatus === 'success' ? '连接成功' : runningHubTestStatus === 'testing' ? '正在自动测试...' : runningHubTestMessage}
                                </span>
                             )}
                           </div>
                           <button
                             onClick={handleTestRunningHub}
                             disabled={runningHubTestStatus === 'testing'}
                             className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-amber-50 dark:hover:bg-amber-500/10 text-gray-500 hover:text-amber-600 text-sm font-bold transition-all border border-gray-200 dark:border-white/10 min-w-[104px] flex items-center justify-center"
                           >
                             {runningHubTestStatus === 'testing' ? <RefreshCw className="w-3 h-3 animate-spin" /> : '测试连接'}
                           </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Virse Config */}
                  <div className={`p-7 lg:p-8 rounded-3xl border transition-all ${virseEnabled ? 'bg-white dark:bg-white/5 border-violet-200 dark:border-violet-500/30' : 'bg-gray-50/50 dark:bg-black/20 border-gray-200 dark:border-white/5 opacity-80'}`}>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-2xl ${virseEnabled ? 'bg-violet-100 text-violet-600' : 'bg-gray-200 text-gray-500'}`}>
                          <Sparkles className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className={`text-lg font-black ${virseEnabled ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>Virse 创意平台</h4>
                            <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-600 text-[10px] font-black">MCP</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">连接 Virse 图片模型、工作区与创意画布</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const nextEnabled = !virseEnabled;
                          setVirseEnabled(nextEnabled);
                          localStorage.setItem('virse_enabled', String(nextEnabled));
                          window.dispatchEvent(new Event('api-settings-updated'));
                        }}
                        className={`relative w-12 h-6 rounded-full transition-colors ${virseEnabled ? 'bg-violet-500' : 'bg-gray-300'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${virseEnabled ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>

                    {virseEnabled && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-gray-500 flex items-center gap-2"><Globe className="w-4 h-4" /> API 节点</label>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => {
                                if (virseBaseUrl === DEFAULT_VIRSE_BASE_URL) return;
                                setVirseBaseUrl(DEFAULT_VIRSE_BASE_URL);
                                setVirseSpaceId('');
                                setVirseCanvasId('');
                                setVirseWorkspaces([]);
                                setVirseTestStatus('idle');
                              }}
                              disabled={virseTestStatus === 'testing'}
                              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${virseBaseUrl === DEFAULT_VIRSE_BASE_URL ? 'bg-violet-50 border-violet-200 text-violet-600' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500'}`}
                            >
                              API 节点（默认/新版）
                            </button>
                            <button
                              onClick={() => {
                                if (virseBaseUrl === VIRSE_DEV_BASE_URL) return;
                                setVirseBaseUrl(VIRSE_DEV_BASE_URL);
                                setVirseSpaceId('');
                                setVirseCanvasId('');
                                setVirseWorkspaces([]);
                                setVirseTestStatus('idle');
                              }}
                              disabled={virseTestStatus === 'testing'}
                              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${virseBaseUrl === VIRSE_DEV_BASE_URL ? 'bg-violet-50 border-violet-200 text-violet-600' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500'}`}
                            >
                              Dev 节点（备用/认证文档）
                            </button>
                          </div>
                          <div className="px-4 py-3 rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20 text-xs font-mono text-violet-700 dark:text-violet-300">
                            {virseBaseUrl}/mcp
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-gray-500 flex items-center gap-2"><Key className="w-4 h-4" /> Virse API Key</label>
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
                              rows={3}
                              style={{ WebkitTextSecurity: isVirseKeyVisible ? 'none' : 'disc' } as React.CSSProperties}
                              className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-5 py-4 text-base focus:ring-2 focus:ring-violet-500/20 outline-none font-mono resize-none"
                              placeholder="virse_sk_..."
                            />
                            <button onClick={() => setIsVirseKeyVisible(!isVirseKeyVisible)} className="absolute right-3 top-3 text-gray-400">
                              {isVirseKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <p className="text-[10px] text-gray-500">在 Virse 获取 API Key；测试连接会同步账户、工作区和实时模型列表。</p>
                        </div>

                        {virseWorkspaces.length > 0 && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-sm font-bold text-gray-500">目标工作区 / 画布</label>
                              <select
                                value={virseSpaceId && virseCanvasId ? JSON.stringify([virseSpaceId, virseCanvasId]) : ''}
                                disabled={virseTestStatus === 'testing'}
                                onChange={(e) => {
                                  const workspace = virseWorkspaces.find((item) => JSON.stringify([item.space_id, item.canvas_id]) === e.target.value);
                                  if (!workspace) return;
                                  setVirseCanvasId(workspace.canvas_id);
                                  setVirseSpaceId(workspace.space_id);
                                  localStorage.setItem('virse_canvas_id', workspace.canvas_id);
                                  localStorage.setItem('virse_space_id', workspace.space_id);
                                  window.dispatchEvent(new Event('api-settings-updated'));
                                }}
                                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none"
                              >
                                <option value="" disabled>请选择目标画布</option>
                                {virseWorkspaces.map((workspace) => (
                                  <option key={JSON.stringify([workspace.space_id, workspace.canvas_id])} value={JSON.stringify([workspace.space_id, workspace.canvas_id])}>
                                    {workspace.name || workspace.organization_name || workspace.space_id}
                                  </option>
                                ))}
                              </select>
                              <p className="text-xs text-gray-500">选择后立即生效。页面可见时每 30 秒同步，切回页面立即核验并移除失效画布。</p>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-bold text-gray-500">默认图片模型</label>
                              <select
                                value={virseModel}
                                onChange={(e) => setVirseModel(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none"
                              >
                                {virseModels.map((model) => (
                                  <option key={model.id} value={model.id}>
                                    {model.name || model.id}{model.provider ? ` · ${model.provider}` : ''}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-4 mt-2">
                          <div className="flex-1 min-w-0">
                            {virseTestStatus !== 'idle' && (
                              <span className={`text-xs font-bold break-words ${virseTestStatus === 'success' ? 'text-green-500' : virseTestStatus === 'testing' ? 'text-blue-500' : 'text-red-500'}`}>
                                {virseTestMessage}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={handleTestVirse}
                            disabled={virseTestStatus === 'testing'}
                            className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-violet-50 dark:hover:bg-violet-500/10 text-gray-500 hover:text-violet-600 text-sm font-bold transition-all border border-gray-200 dark:border-white/10 min-w-[104px] flex items-center justify-center"
                          >
                            {virseTestStatus === 'testing' ? <RefreshCw className="w-3 h-3 animate-spin" /> : '测试并同步'}
                          </button>
                        </div>
                        <button
                          disabled={!virseApiKey.trim() || virseDiagnosticLoading || virseTestStatus === 'testing'}
                          onClick={async () => {
                            const version = virseSyncVersion.current;
                            setVirseDiagnosticLoading(true);
                            try {
                              const diagnostic = await getVirseWorkspaceDiagnostic(virseApiKey.trim(), virseBaseUrl);
                              if (version === virseSyncVersion.current) setVirseDiagnostic(diagnostic);
                            } catch {
                              if (version === virseSyncVersion.current) setVirseDiagnostic('诊断请求失败，请稍后重试。');
                            } finally {
                              setVirseDiagnosticLoading(false);
                            }
                          }}
                          className="text-xs text-gray-600 dark:text-gray-300 underline disabled:opacity-50"
                        >
                          {virseDiagnosticLoading ? '正在读取工作区诊断…' : '工作区列表不一致？读取诊断'}
                        </button>
                        {virseDiagnostic && (
                          <details className="rounded-2xl border border-amber-200 bg-amber-50/70 dark:bg-amber-500/10 dark:border-amber-500/30 p-4">
                            <summary className="cursor-pointer text-xs font-bold text-amber-700 dark:text-amber-300">
                              展开查看工作区诊断（不含 API Key）
                            </summary>
                            <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-all text-[11px] leading-5 text-gray-700 dark:text-gray-200 select-text">
                              {virseDiagnostic}
                            </pre>
                          </details>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Native Gemini Config */}
                  <div className={`p-7 lg:p-8 rounded-3xl border transition-all ${nativeEnabled ? 'bg-white dark:bg-white/5 border-blue-200 dark:border-blue-500/30' : 'bg-gray-50/50 dark:bg-black/20 border-gray-200 dark:border-white/5 opacity-80'}`}>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-2xl ${nativeEnabled ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500'}`}>
                          <Cpu className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className={`text-lg font-black ${nativeEnabled ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>Google Gemini 原生 API</h4>
                          <p className="text-xs text-gray-500 mt-0.5">直接使用 Google 官方 API 接口</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setNativeEnabled(!nativeEnabled)}
                        className={`relative w-12 h-6 rounded-full transition-colors ${nativeEnabled ? 'bg-blue-500' : 'bg-gray-300'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${nativeEnabled ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>

                    {nativeEnabled && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-gray-500 flex items-center gap-2"><Key className="w-4 h-4" /> API Key</label>
                          <div className="relative">
                            <textarea
                              value={nativeApiKey}
                              onChange={(e) => setNativeApiKey(e.target.value)}
                              rows={4}
                              style={{ WebkitTextSecurity: isNativeKeyVisible ? 'none' : 'disc' } as React.CSSProperties}
                              className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-5 py-4 text-base focus:ring-2 focus:ring-blue-500/20 outline-none font-mono resize-none"
                              placeholder="AIzaSy..."
                            />
                            <button onClick={() => setIsNativeKeyVisible(!isNativeKeyVisible)} className="absolute right-3 top-3 text-gray-400">
                              {isNativeKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <p className="text-[10px] text-gray-500">Google 官方 Key，通常建议仅填一个。</p>
                        </div>
                        <div className="flex items-center justify-between gap-4 mt-2">
                           <div className="flex-1">
                             {nativeTestStatus !== 'idle' && (
                                <span className={`text-xs font-bold ${nativeTestStatus === 'success' ? 'text-green-500' : nativeTestStatus === 'testing' ? 'text-blue-500' : 'text-red-500'}`}>
                                 {nativeTestStatus === 'success' ? '连接成功' : nativeTestStatus === 'testing' ? '正在自动测试...' : nativeTestMessage}
                               </span>
                             )}
                           </div>
                           <button
                             onClick={handleTestNative}
                             disabled={nativeTestStatus === 'testing'}
                             className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-blue-50 dark:hover:bg-blue-500/10 text-gray-500 hover:text-blue-600 text-sm font-bold transition-all border border-gray-200 dark:border-white/10 min-w-[104px] flex items-center justify-center"
                           >
                             {nativeTestStatus === 'testing' ? <RefreshCw className="w-3 h-3 animate-spin" /> : '测试连接'}
                           </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Yunwu Config */}
                  <div className={`p-7 lg:p-8 rounded-3xl border transition-all ${yunwuEnabled ? 'bg-white dark:bg-white/5 border-brand-orange/30' : 'bg-gray-50/50 dark:bg-black/20 border-gray-200 dark:border-white/5 opacity-80'}`}>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-2xl ${yunwuEnabled ? 'bg-orange-100 text-brand-orange' : 'bg-gray-200 text-gray-500'}`}>
                          <Cloud className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className={`text-lg font-black ${yunwuEnabled ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>云雾 API 中转站</h4>
                          <p className="text-xs text-gray-500 mt-0.5">标准兼容型 Gemini 中转服务</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const nextEnabled = !yunwuEnabled;
                          setYunwuEnabled(nextEnabled);
                          localStorage.setItem('yunwu_enabled', String(nextEnabled));
                          window.dispatchEvent(new Event('api-settings-updated'));
                        }}
                        className={`relative w-12 h-6 rounded-full transition-colors ${yunwuEnabled ? 'bg-brand-orange' : 'bg-gray-300'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${yunwuEnabled ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>

                    {yunwuEnabled && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-gray-500 flex items-center gap-2"><Globe className="w-4 h-4" /> API 节点选择</label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            <button
                              onClick={() => setYunwuBaseUrl('https://yunwu.ai')}
                              className={`px-4 py-2 text-xs rounded-full border transition-all ${yunwuBaseUrl === 'https://yunwu.ai' ? 'bg-orange-100 border-orange-300 text-orange-700' : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:border-orange-200'}`}
                            >
                              主站节点
                            </button>
                            <button
                              onClick={() => setYunwuBaseUrl('https://api.apiplus.org')}
                              className={`px-4 py-2 text-xs rounded-full border transition-all ${yunwuBaseUrl === 'https://api.apiplus.org' ? 'bg-orange-100 border-orange-300 text-orange-700' : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:border-orange-200'}`}
                            >
                              CF站节点
                            </button>
                            <button
                              onClick={() => setYunwuBaseUrl('https://api3.wlai.vip')}
                              className={`px-4 py-2 text-xs rounded-full border transition-all ${yunwuBaseUrl === 'https://api3.wlai.vip' ? 'bg-orange-100 border-orange-300 text-orange-700' : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:border-orange-200'}`}
                            >
                              国内节点
                            </button>
                            <button
                              onClick={() => setYunwuBaseUrl('https://api.zhongzhuan.chat')}
                              className={`px-4 py-2 text-xs rounded-full border transition-all ${yunwuBaseUrl === 'https://api.zhongzhuan.chat' ? 'bg-orange-100 border-orange-300 text-orange-700' : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:border-orange-200'}`}
                            >
                              中转节点
                            </button>
                            <button
                              type="button"
                              onClick={() => setYunwuBaseUrl(YUNWU_OVERSEAS_BASE_URL)}
                              className={`px-4 py-2 text-xs rounded-full border transition-all ${yunwuBaseUrl === YUNWU_OVERSEAS_BASE_URL ? 'bg-orange-100 border-orange-300 text-orange-700' : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:border-orange-200'}`}
                            >
                              海外节点
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-gray-500 flex items-center gap-2"><Key className="w-4 h-4" /> API Key</label>
                          <div className="relative">
                            <textarea
                              value={yunwuApiKey}
                              onChange={(e) => setYunwuApiKey(e.target.value)}
                              rows={4}
                              style={{ WebkitTextSecurity: isYunwuKeyVisible ? 'none' : 'disc' } as React.CSSProperties}
                              className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-5 py-4 text-base focus:ring-2 focus:ring-orange-500/20 outline-none font-mono resize-none"
                              placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                            />
                            <button onClick={() => setIsYunwuKeyVisible(!isYunwuKeyVisible)} className="absolute right-3 top-3 text-gray-400">
                              {isYunwuKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <p className="text-[10px] text-gray-500">支持多 Key 轮询，请使用逗号或换行分隔。</p>
                        </div>
                        {/* 默认模型选择已根据用户要求隐藏，保持与柏拉图一致 */}
                        <div className="flex items-center justify-between gap-4 mt-2">
                           <div className="flex-1">
                             {yunwuTestStatus !== 'idle' && (
                                <span className={`text-xs font-bold ${yunwuTestStatus === 'success' ? 'text-green-500' : yunwuTestStatus === 'testing' ? 'text-blue-500' : 'text-red-500'}`}>
                                 {yunwuTestStatus === 'success' ? '连接成功' : yunwuTestStatus === 'testing' ? '正在自动测试...' : yunwuTestMessage}
                               </span>
                             )}
                           </div>
                           <button
                             onClick={handleTestYunwu}
                             disabled={yunwuTestStatus === 'testing'}
                             className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-orange-50 dark:hover:bg-orange-500/10 text-gray-500 hover:text-orange-600 text-sm font-bold transition-all border border-gray-200 dark:border-white/10 min-w-[104px] flex items-center justify-center"
                           >
                             {yunwuTestStatus === 'testing' ? <RefreshCw className="w-3 h-3 animate-spin" /> : '测试连接'}
                           </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : activeTab === 'cache' ? (
                <div className="space-y-8 max-w-4xl">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-6 rounded-3xl border border-orange-100 dark:border-orange-500/20 bg-orange-50/60 dark:bg-orange-500/10">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-11 h-11 rounded-2xl bg-white dark:bg-white/10 text-brand-orange flex items-center justify-center">
                          <Database className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-500">项目历史</p>
                          <h4 className="text-2xl font-black text-gray-900 dark:text-white">{cacheStats?.projectCount ?? 0}</h4>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">保存在浏览器 IndexedDB 中。</p>
                    </div>

                    <div className="p-6 rounded-3xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-11 h-11 rounded-2xl bg-gray-100 dark:bg-white/10 text-gray-500 flex items-center justify-center">
                          <HardDrive className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-500">项目估算占用</p>
                          <h4 className="text-2xl font-black text-gray-900 dark:text-white">{formatBytes(cacheStats?.estimatedProjectBytes)}</h4>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">仅统计本应用项目图片与历史。</p>
                    </div>

                    <div className="p-6 rounded-3xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-11 h-11 rounded-2xl bg-gray-100 dark:bg-white/10 text-gray-500 flex items-center justify-center">
                          <Cloud className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-500">浏览器总占用</p>
                          <h4 className="text-2xl font-black text-gray-900 dark:text-white">{formatBytes(cacheStats?.storageUsage)}</h4>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">浏览器提供的站点存储估算值。</p>
                    </div>
                  </div>

                  <div className="p-7 lg:p-8 rounded-3xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5">
                    <div className="flex items-start justify-between gap-4 mb-6">
                      <div>
                        <h4 className="text-lg font-black text-gray-900 dark:text-white">安全清理</h4>
                        <p className="text-sm text-gray-500 mt-1">只清理项目历史和生成图片缓存，不会删除 API Key、模型配置和智能体设定。</p>
                        <p className="text-xs font-bold text-orange-600 mt-2">自动清理：生成后的项目图片会在 30 分钟后自动清理；若浏览器存储超过 2GB，也会仅保留最近 50 个项目。</p>
                      </div>
                      <button
                        onClick={loadCacheStats}
                        disabled={cacheBusy}
                        className="px-4 py-2 rounded-xl text-xs font-bold border border-gray-200 dark:border-white/10 text-gray-500 hover:text-brand-orange hover:border-orange-200 transition-all disabled:opacity-50"
                      >
                        刷新容量
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        onClick={() => runCacheCleanup('older7')}
                        disabled={cacheBusy}
                        className="p-4 rounded-2xl bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 text-left hover:border-orange-200 hover:bg-orange-50/60 transition-all disabled:opacity-50"
                      >
                        <p className="text-sm font-black text-gray-900 dark:text-white">清理 7 天前项目</p>
                        <p className="text-xs text-gray-500 mt-1">适合频繁生成时快速释放空间。</p>
                      </button>
                      <button
                        onClick={() => runCacheCleanup('older30')}
                        disabled={cacheBusy}
                        className="p-4 rounded-2xl bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 text-left hover:border-orange-200 hover:bg-orange-50/60 transition-all disabled:opacity-50"
                      >
                        <p className="text-sm font-black text-gray-900 dark:text-white">清理 30 天前项目</p>
                        <p className="text-xs text-gray-500 mt-1">保留最近一个月的工作记录。</p>
                      </button>
                      <button
                        onClick={() => runCacheCleanup('keep50')}
                        disabled={cacheBusy}
                        className="p-4 rounded-2xl bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 text-left hover:border-orange-200 hover:bg-orange-50/60 transition-all disabled:opacity-50"
                      >
                        <p className="text-sm font-black text-gray-900 dark:text-white">只保留最近 50 个</p>
                        <p className="text-xs text-gray-500 mt-1">历史很多时优先保留最新项目。</p>
                      </button>
                      <button
                        onClick={() => runCacheCleanup('all')}
                        disabled={cacheBusy}
                        className="p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-left hover:border-red-300 transition-all disabled:opacity-50"
                      >
                        <p className="text-sm font-black text-red-600">清空全部项目历史</p>
                        <p className="text-xs text-red-500/80 mt-1">仅在浏览器已经明显卡顿时使用。</p>
                      </button>
                    </div>

                    {cacheMessage && (
                      <div className="mt-5 rounded-2xl bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 px-4 py-3 text-sm font-bold text-gray-600 dark:text-gray-300">
                        {cacheBusy ? '正在处理，请稍等...' : cacheMessage}
                      </div>
                    )}
                  </div>
                </div>
              ) : activeTab === 'image-host' ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-5xl">
                  <div className="p-6 rounded-3xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5">
                    <div className="flex items-center gap-3 pb-5 border-b border-gray-100 dark:border-white/10">
                      <div className="w-11 h-11 rounded-2xl bg-gray-100 dark:bg-white/10 flex items-center justify-center">
                        <ImageIcon className="w-5 h-5 text-gray-700 dark:text-gray-200" />
                      </div>
                      <div>
                        <h4 className="text-lg font-black text-gray-900 dark:text-white">图床服务商</h4>
                        <p className="text-xs text-gray-500 mt-1">为 Virse 参考图生成临时公网地址</p>
                      </div>
                    </div>

                    <div className="space-y-3 mt-6">
                      <button
                        type="button"
                        onClick={() => setImageHostProvider('none')}
                        className={`w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-all ${imageHostProvider === 'none' ? 'border-gray-900 dark:border-white bg-gray-50 dark:bg-white/10' : 'border-gray-200 dark:border-white/10 hover:border-gray-300'}`}
                      >
                        <X className="w-5 h-5 text-gray-400" />
                        <div className="flex-1">
                          <p className="text-sm font-black text-gray-900 dark:text-white">不启用</p>
                          <p className="text-xs text-gray-500 mt-0.5">仅使用 Virse 原生上传服务</p>
                        </div>
                        {imageHostProvider === 'none' && <Check className="w-5 h-5" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setImageHostProvider('imgbb')}
                        className={`w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-all ${imageHostProvider === 'imgbb' ? 'border-gray-900 dark:border-white bg-gray-50 dark:bg-white/10' : 'border-gray-200 dark:border-white/10 hover:border-gray-300'}`}
                      >
                        <div className="w-9 h-9 rounded-xl bg-gray-950 text-white flex items-center justify-center">
                          <ImageIcon className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-black text-gray-900 dark:text-white">ImgBB</p>
                          <p className="text-xs text-gray-500 mt-0.5">官方 API · 临时图片 10 分钟自动删除</p>
                        </div>
                        {imageHostProvider === 'imgbb' && <Check className="w-5 h-5" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setImageHostProvider('freeimage')}
                        className={`w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-all ${imageHostProvider === 'freeimage' ? 'border-gray-900 dark:border-white bg-gray-50 dark:bg-white/10' : 'border-gray-200 dark:border-white/10 hover:border-gray-300'}`}
                      >
                        <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                          <Globe className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-black text-gray-900 dark:text-white">FreeImage.host</p>
                          <p className="text-xs text-gray-500 mt-0.5">API v1 接口 · 免费公共图床上传</p>
                        </div>
                        {imageHostProvider === 'freeimage' && <Check className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {imageHostProvider === 'freeimage' ? (
                    <div className="p-6 rounded-3xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5">
                      <div className="flex items-center gap-3 pb-5 border-b border-gray-100 dark:border-white/10">
                        <div className="w-11 h-11 rounded-2xl bg-gray-100 dark:bg-white/10 flex items-center justify-center">
                          <Key className="w-5 h-5 text-gray-700 dark:text-gray-200" />
                        </div>
                        <h4 className="text-lg font-black text-gray-900 dark:text-white">FreeImage.host 参数</h4>
                      </div>

                      <div className="mt-6">
                        <label className="text-xs font-black tracking-wider text-gray-600 dark:text-gray-300">API KEY</label>
                        <div className="relative mt-2">
                          <textarea
                            rows={4}
                            value={freeimageApiKey}
                            onChange={(event) => {
                              setFreeimageApiKey(event.target.value);
                              setFreeimageTestStatus('idle');
                              setFreeimageTestMessage('');
                            }}
                            placeholder="输入 FreeImage.host API Key"
                            autoComplete="off"
                            style={isFreeimageKeyVisible ? undefined : ({ WebkitTextSecurity: 'disc' } as React.CSSProperties)}
                            className="w-full resize-none rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 px-4 py-4 pr-12 text-sm leading-6 text-gray-900 dark:text-white outline-none focus:border-brand-orange"
                          />
                          <button
                            type="button"
                            onClick={() => setIsFreeimageKeyVisible((visible) => !visible)}
                            className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"
                          >
                            {isFreeimageKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {freeimageApiKey.split(/[\n,;]+/).filter((key) => key.trim()).length > 1
                              ? `已配置 ${freeimageApiKey.split(/[\n,;]+/).filter((key) => key.trim()).length} 个 Key，将按请求轮询使用`
                              : '支持多个 Key，每行一个；生成时自动轮询并跳过不可用 Key'}
                          </div>
                          <button
                            type="button"
                            disabled={freeimageTestStatus === 'testing'}
                            onClick={handleTestFreeImage}
                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-black text-gray-700 shadow-sm transition hover:border-brand-orange hover:text-brand-orange disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200"
                          >
                            {freeimageTestStatus === 'testing' && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                            {freeimageTestStatus === 'testing' ? '测试中...' : '测试连接'}
                          </button>
                        </div>
                        {freeimageTestMessage && (
                          <div className={`mt-3 rounded-xl px-3 py-2.5 text-xs font-bold ${freeimageTestStatus === 'success'
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300'
                            : freeimageTestStatus === 'error'
                              ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300'
                              : 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'}`}
                          >
                            {freeimageTestMessage}
                          </div>
                        )}
                        <p className="mt-4 text-xs leading-5 text-gray-500">
                          Key 仅保存在当前浏览器，上传时通过 API v1 (https://freeimage.host/api/1/upload) 上传图片。可从{' '}
                          <a href="https://freeimage.host/page/api" target="_blank" rel="noreferrer" className="font-bold text-brand-orange hover:underline">FreeImage.host API</a>
                          {' '}获取 API 密钥。
                        </p>
                      </div>
                    </div>
                  ) : imageHostProvider === 'imgbb' ? (
                    <div className="p-6 rounded-3xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5">
                      <div className="flex items-center gap-3 pb-5 border-b border-gray-100 dark:border-white/10">
                        <div className="w-11 h-11 rounded-2xl bg-gray-100 dark:bg-white/10 flex items-center justify-center">
                          <Key className="w-5 h-5 text-gray-700 dark:text-gray-200" />
                        </div>
                        <h4 className="text-lg font-black text-gray-900 dark:text-white">ImgBB 参数</h4>
                      </div>

                      <div className="mt-6">
                        <label className="text-xs font-black tracking-wider text-gray-600 dark:text-gray-300">API KEY</label>
                        <div className="relative mt-2">
                          <textarea
                            rows={4}
                            value={imgbbApiKey}
                            disabled={imageHostProvider !== 'imgbb'}
                            onChange={(event) => {
                              setImgbbApiKey(event.target.value);
                              setImgbbTestStatus('idle');
                              setImgbbTestMessage('');
                            }}
                            placeholder="输入 ImgBB API Key"
                            autoComplete="off"
                            style={isImgbbKeyVisible ? undefined : ({ WebkitTextSecurity: 'disc' } as React.CSSProperties)}
                            className="w-full resize-none rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 px-4 py-4 pr-12 text-sm leading-6 text-gray-900 dark:text-white outline-none focus:border-brand-orange disabled:cursor-not-allowed"
                          />
                          <button
                            type="button"
                            disabled={imageHostProvider !== 'imgbb'}
                            onClick={() => setIsImgbbKeyVisible((visible) => !visible)}
                            className="absolute right-4 top-4 text-gray-400 hover:text-gray-700 disabled:cursor-not-allowed"
                          >
                            {isImgbbKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {imgbbApiKey.split(/[\n,;]+/).filter((key) => key.trim()).length > 1
                              ? `已配置 ${imgbbApiKey.split(/[\n,;]+/).filter((key) => key.trim()).length} 个 Key，将按请求轮询使用`
                              : '支持多个 Key，每行一个；生成时自动轮询并跳过不可用 Key'}
                          </div>
                          <button
                            type="button"
                            disabled={imageHostProvider !== 'imgbb' || imgbbTestStatus === 'testing'}
                            onClick={handleTestImgBb}
                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-black text-gray-700 shadow-sm transition hover:border-brand-orange hover:text-brand-orange disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200"
                          >
                            {imgbbTestStatus === 'testing' && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                            {imgbbTestStatus === 'testing' ? '测试中...' : '测试连接'}
                          </button>
                        </div>
                        {imgbbTestMessage && (
                          <div className={`mt-3 rounded-xl px-3 py-2.5 text-xs font-bold ${imgbbTestStatus === 'success'
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300'
                            : imgbbTestStatus === 'error'
                              ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300'
                              : 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'}`}
                          >
                            {imgbbTestMessage}
                          </div>
                        )}
                        <p className="mt-4 text-xs leading-5 text-gray-500">
                          Key 仅保存在当前浏览器，并在上传参考图时发送给同源后端。可从{' '}
                          <a href="https://api.imgbb.com/" target="_blank" rel="noreferrer" className="font-bold text-brand-orange hover:underline">ImgBB API</a>
                          {' '}获取。
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 rounded-3xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 flex flex-col justify-center items-center text-center">
                      <X className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
                      <h4 className="text-base font-black text-gray-800 dark:text-gray-200">第三方图床服务已禁用</h4>
                      <p className="text-xs text-gray-500 mt-2 max-w-xs leading-relaxed">
                        当前设置为不使用第三方图床，参考图生成将直接通过 Virse 原生上传接口传输。
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-8 max-w-3xl">
                  <div className={`rounded-3xl border p-6 transition-all ${deepThinkingEnabled ? 'border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 dark:border-orange-500/40 dark:from-orange-500/10 dark:to-amber-500/5' : 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/25 dark:bg-emerald-500/5'}`}>
                    <div className="flex items-start justify-between gap-5">
                      <div className="flex min-w-0 items-start gap-4">
                        <div className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${deepThinkingEnabled ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15'}`}>
                          {deepThinkingEnabled ? <Sparkles className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-base font-black text-gray-900 dark:text-white">开启深度思考</h4>
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${deepThinkingEnabled ? 'bg-orange-500 text-white' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'}`}>
                              {deepThinkingEnabled ? '高性能模式' : '低功耗模式'}
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs leading-5 text-gray-500 dark:text-gray-400">
                            {deepThinkingEnabled
                              ? '全站文本对话与智能分析将轮换使用高性能模型，异常时自动切换备用模型。'
                              : '默认使用经济型模型，兼顾响应速度与调用成本。'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={deepThinkingEnabled}
                        aria-label="开启深度思考"
                        onClick={() => {
                          const enabled = !deepThinkingEnabled;
                          setDeepThinkingEnabled(enabled);
                          setTextModelPowerMode(enabled ? 'deep-thinking' : 'low-power');
                        }}
                        className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-4 focus:ring-orange-500/15 ${deepThinkingEnabled ? 'bg-orange-500' : 'bg-gray-300 dark:bg-white/15'}`}
                      >
                        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${deepThinkingEnabled ? 'left-6' : 'left-1'}`} />
                      </button>
                    </div>

                    <div className="mt-5 border-t border-black/5 pt-4 dark:border-white/10">
                      <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-gray-400">当前模型池 · 自动轮换与故障回退</p>
                      <div className="flex flex-wrap gap-2">
                        {(deepThinkingEnabled ? DEEP_THINKING_TEXT_MODELS : LOW_POWER_TEXT_MODELS).map((model) => (
                          <span key={model} className="rounded-xl border border-white/70 bg-white/80 px-3 py-1.5 font-mono text-[11px] font-bold text-gray-600 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                            {model}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-blue-200 bg-blue-50/60 p-6 dark:border-blue-500/25 dark:bg-blue-500/5">
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
                        <Bot className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-base font-black text-gray-900 dark:text-white">文本 / Agent 服务</h4>
                        <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
                          文本对话、提示词优化和图片分析使用这里选择的中转；图片生成由 {virseEnabled ? 'Virse（千问除外）' : '当前图像服务'} 处理。
                        </p>
                        <select
                          value={textApiProvider}
                          onChange={(event) => setTextApiProvider(event.target.value as typeof textApiProvider)}
                          className="mt-4 w-full rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-blue-500/25 dark:bg-white/5 dark:text-white"
                        >
                          <option value="auto">自动选择（按已启用服务优先级）</option>
                          <option value="deepseek">DeepSeek 原生 API</option>
                          <option value="plato">柏拉图 API</option>
                          <option value="yunwu">云雾 API</option>
                          <option value="runninghub">RunningHub API</option>
                          <option value="native">Google Gemini 原生 API</option>
                        </select>
                        {virseEnabled && (
                          <div className="mt-3 rounded-xl bg-violet-50 px-3 py-2 text-xs font-bold text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
                            当前能力路由：图像 → Virse（千问 → 千问 API）；文本 / Agent → {
                              textApiProvider === 'auto'
                                ? '自动选择'
                                : textApiProvider === 'deepseek'
                                  ? 'DeepSeek 原生 API'
                                  : textApiProvider
                            }
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">智能体名称 (Agent Name)</label>
                      <input
                        type="text"
                        value={agentName}
                        onChange={(e) => setAgentName(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-brand-orange/50 outline-none"
                        placeholder="例如：XcAI 首席视觉策划师"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">角色设定 (Role Description)</label>
                      <textarea
                        value={agentRole}
                        onChange={(e) => setAgentRole(e.target.value)}
                        rows={4}
                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-brand-orange/50 outline-none resize-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2"><BookOpen className="w-4 h-4 text-brand-orange" /> 能力与指令 (Capabilities)</label>
                      <textarea
                        value={agentCapabilities}
                        onChange={(e) => setAgentCapabilities(e.target.value)}
                        rows={6}
                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-brand-orange/50 outline-none resize-none leading-relaxed"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-100 dark:border-white/5 bg-gray-50/30 dark:bg-black/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {testStatus === 'success' && (
                  <span className="text-xs font-bold text-green-500 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> {testMessage}
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-6 py-3 rounded-2xl text-sm font-bold text-gray-500 hover:text-gray-700 dark:hover:text-white transition-all"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveAll}
                  className="px-8 py-3 rounded-2xl text-sm font-bold bg-brand-orange text-white shadow-xl shadow-orange-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  保存配置
                </button>
              </div>
            </div>
          </div>

          {showUsageGuide && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 backdrop-blur-sm p-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                className="w-full max-w-xl rounded-[1.75rem] bg-white dark:bg-[#181818] border border-gray-200 dark:border-white/10 shadow-2xl overflow-hidden"
              >
                <div className="p-7 border-b border-gray-100 dark:border-white/5 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-orange-50 text-brand-orange flex items-center justify-center border border-orange-100">
                      <HelpCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-gray-900 dark:text-white">模型配置使用说明</h4>
                      <p className="text-sm text-gray-500 mt-1">首页保存一次，所有工作区都会自动读取。</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowUsageGuide(false)}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-white/10 transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-7 space-y-4">
                  {[
                    '先开启要使用的服务：柏拉图、Google Gemini 原生 API 或云雾。',
                    '柏拉图和云雾只需要选择站点节点，再填写 API Key；节点地址会在后台保留。',
                    '输入或修改 Key 后会自动检测连接状态，也可以点击“测试连接”手动重试。',
                    '确认连接成功后点击“保存配置”，摄影实验室、AI 创意视频、精修工作台和创意中心会共用这套配置。'
                  ].map((item, index) => (
                    <div key={item} className="flex gap-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-4">
                      <div className="w-7 h-7 rounded-full bg-brand-orange text-white flex items-center justify-center text-xs font-black shrink-0">
                        {index + 1}
                      </div>
                      <p className="text-sm leading-6 text-gray-700 dark:text-gray-300">{item}</p>
                    </div>
                  ))}
                </div>

                <div className="px-7 pb-7 flex justify-end">
                  <button
                    onClick={() => setShowUsageGuide(false)}
                    className="px-6 py-3 rounded-2xl text-sm font-bold bg-brand-orange text-white shadow-lg shadow-orange-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    我知道了
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
