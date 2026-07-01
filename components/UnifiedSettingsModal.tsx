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
  Database
} from 'lucide-react';
import { resolveRuntimeModelId } from '../Cyzx4/utils/apiHelpers';
import { storageService, CacheStats } from '../services/storageService';
import { deleteFromStorage } from '../XcAISTUDIO-main/services/storage';

interface UnifiedSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'model' | 'agent' | 'cache';
}

const DEFAULT_BASE_URL = 'https://yunwu.ai';
const DEFAULT_VOLCENGINE_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
const DEFAULT_RIGHT_BASE_URL = 'https://www.right.codes/draw';
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
  const [activeTab, setActiveTab] = useState<'model' | 'agent' | 'cache'>(initialTab);

  // Agent Settings State
  const [agentName, setAgentName] = useState('XcAI 首席电商视觉策划师');
  const [agentRole, setAgentRole] = useState('你是一个拥有10年经验的亚马逊/独立站电商视觉总监。你的目标是根据用户提供的产品信息或图片，策划出高转化率的视觉方案。');
  const [agentCapabilities, setAgentCapabilities] = useState('1. 深入分析产品卖点与目标市场\n2. 策划高转化率的电商图片（主图、副图、A+）\n3. 保持专业、精炼的语言风格');

  // Model Settings State
  const [nativeApiKey, setNativeApiKey] = useState('');
  const [isNativeKeyVisible, setIsNativeKeyVisible] = useState(false);
  const [nativeEnabled, setNativeEnabled] = useState(true);
  
  const [yunwuApiKey, setYunwuApiKey] = useState('');
  const [yunwuBaseUrl, setYunwuBaseUrl] = useState(DEFAULT_BASE_URL);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [isYunwuKeyVisible, setIsYunwuKeyVisible] = useState(false);
  const [yunwuEnabled, setYunwuEnabled] = useState(true);
  
  const [platoApiKey, setPlatoApiKey] = useState('');
  const [platoBaseUrl, setPlatoBaseUrl] = useState('https://api.bltcy.ai');
  const [isPlatoKeyVisible, setIsPlatoKeyVisible] = useState(false);
  const [platoEnabled, setPlatoEnabled] = useState(false);

  const [jijingApiKey, setJijingApiKey] = useState('');
  const [jijingBaseUrl, setJijingBaseUrl] = useState(DEFAULT_NO1_IMAGE_BASE_URL);
  const [isJijingKeyVisible, setIsJijingKeyVisible] = useState(false);
  const [jijingEnabled, setJijingEnabled] = useState(false);

  const [rightApiKey, setRightApiKey] = useState('');
  const [rightBaseUrl, setRightBaseUrl] = useState(DEFAULT_RIGHT_BASE_URL);
  const [isRightKeyVisible, setIsRightKeyVisible] = useState(false);
  const [rightEnabled, setRightEnabled] = useState(false);

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

  const [rightTestStatus, setRightTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [rightTestMessage, setRightTestMessage] = useState('');
  
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

  const nativeAutoTestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const yunwuAutoTestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const platoAutoTestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jijingAutoTestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rightAutoTestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoNativeKeyRef = useRef('');
  const lastAutoYunwuKeyRef = useRef('');
  const lastAutoPlatoKeyRef = useRef('');
  const lastAutoJijingKeyRef = useRef('');
  const lastAutoRightKeyRef = useRef('');

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
    if (savedName) setAgentName(savedName);
    if (savedRole) setAgentRole(savedRole);
    if (savedCapabilities) setAgentCapabilities(savedCapabilities);

    // Load Model Settings
    const savedNativeKey = localStorage.getItem('user_api_key');
    const savedNativeEnabled = localStorage.getItem('native_enabled');
    if (savedNativeKey) setNativeApiKey(savedNativeKey);
    lastAutoNativeKeyRef.current = savedNativeKey || '';
    setNativeEnabled(savedNativeEnabled !== 'false');

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
    if (savedPlatoUrl) setPlatoBaseUrl(savedPlatoUrl);
    setPlatoEnabled(savedPlatoEnabled === 'true');

    const savedJijingKey = localStorage.getItem('jijing_api_key');
    const savedJijingUrl = localStorage.getItem('jijing_base_url');
    const savedJijingEnabled = localStorage.getItem('jijing_enabled');
    if (savedJijingKey) setJijingApiKey(savedJijingKey);
    lastAutoJijingKeyRef.current = savedJijingKey || '';
    if (savedJijingUrl) setJijingBaseUrl(savedJijingUrl === LEGACY_JIJING_BASE_URL ? DEFAULT_NO1_IMAGE_BASE_URL : savedJijingUrl);
    setJijingEnabled(savedJijingEnabled === 'true');

    const savedRightKey = localStorage.getItem('right_api_key');
    const savedRightUrl = localStorage.getItem('right_base_url');
    const savedRightEnabled = localStorage.getItem('right_enabled');
    if (savedRightKey) setRightApiKey(savedRightKey);
    lastAutoRightKeyRef.current = savedRightKey || '';
    if (savedRightUrl) setRightBaseUrl(savedRightUrl);
    setRightEnabled(savedRightEnabled === 'true');

    const savedVolcengineKey = localStorage.getItem('volcengine_api_key') || localStorage.getItem('seedance_api_key');
    const savedVolcengineEnabled = localStorage.getItem('seedance_enabled');
    if (savedVolcengineKey) setVolcengineApiKey(savedVolcengineKey);
    setVolcengineEnabled(savedVolcengineEnabled === 'true' || Boolean(savedVolcengineKey));
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

    // Save Model
    const trimmedNative = nativeApiKey.trim();
    localStorage.setItem('user_api_key', trimmedNative);
    localStorage.setItem('user_gemini_api_key', trimmedNative);
    localStorage.setItem('native_enabled', String(nativeEnabled));
    
    localStorage.setItem('yunwu_api_key', yunwuApiKey.trim());
    localStorage.setItem('yunwu_base_url', yunwuBaseUrl.trim() || DEFAULT_BASE_URL);
    localStorage.setItem('yunwu_default_model', selectedModel);
    localStorage.setItem('yunwu_enabled', String(yunwuEnabled));
    
    localStorage.setItem('plato_api_key', platoApiKey.trim());
    localStorage.setItem('plato_base_url', platoBaseUrl.trim() || 'https://api.bltcy.ai');
    localStorage.setItem('plato_enabled', String(platoEnabled));

    localStorage.setItem('jijing_api_key', jijingApiKey.trim());
    localStorage.setItem('jijing_base_url', jijingBaseUrl.trim() || DEFAULT_NO1_IMAGE_BASE_URL);
    localStorage.setItem('jijing_enabled', String(jijingEnabled));

    localStorage.setItem('right_api_key', rightApiKey.trim());
    localStorage.setItem('right_base_url', rightBaseUrl.trim() || DEFAULT_RIGHT_BASE_URL);
    localStorage.setItem('right_enabled', String(rightEnabled));

    localStorage.setItem('volcengine_api_key', volcengineApiKey.trim());
    localStorage.setItem('seedance_api_key', volcengineApiKey.trim());
    localStorage.setItem('seedance_base_url', DEFAULT_VOLCENGINE_BASE_URL);
    localStorage.removeItem('seedance_model');
    localStorage.setItem('seedance_enabled', String(volcengineEnabled));

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
      const res = await sendTestRequest(platoBaseUrl || 'https://api.bltcy.ai', key, 'gemini-3.1-flash-lite-preview', 'Say OK');
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

  const handleTestRight = async () => {
    const key = rightApiKey.split(/[,\n]/).map(k => k.trim()).filter(k => k !== "")[0];
    if (!key) {
      setRightTestStatus('error');
      setRightTestMessage('请输入 API Key');
      return;
    }
    setRightTestStatus('testing');
    setRightTestMessage('正在测试...');
    try {
      const baseUrl = (rightBaseUrl || DEFAULT_RIGHT_BASE_URL).replace(/\/+$/, '');
      const response = await fetch(`${baseUrl}/v1/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${key}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error?.message || errorData.message || `HTTP Error ${response.status}`;
        if (response.status === 401 || response.status === 403) {
          throw new Error(message);
        }
        throw new Error(`${message}; Right server is reachable, but the lightweight model-list check failed. Save and verify with image generation.`);
      }
      setRightTestStatus('success');
      setRightTestMessage('连接成功');
    } catch (e: any) {
      setRightTestStatus('error');
      setRightTestMessage(e?.message || '连接失败');
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
  }, [platoApiKey, platoEnabled, isOpen, settingsLoaded]);

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
    if (!isOpen || !settingsLoaded || !rightEnabled) return;
    const key = rightApiKey.trim();
    if (key === lastAutoRightKeyRef.current) return;
    if (rightAutoTestTimerRef.current) clearTimeout(rightAutoTestTimerRef.current);
    lastAutoRightKeyRef.current = key;
    if (!key) {
      setRightTestStatus('idle');
      setRightTestMessage('');
      return;
    }
    setRightTestStatus('testing');
    setRightTestMessage('输入已更新，正在自动测试...');
    rightAutoTestTimerRef.current = setTimeout(() => {
      void handleTestRight();
    }, 900);
    return () => {
      if (rightAutoTestTimerRef.current) clearTimeout(rightAutoTestTimerRef.current);
    };
  }, [rightApiKey, rightEnabled, isOpen, settingsLoaded]);

  const activeTitle = activeTab === 'model' ? '模型配置' : activeTab === 'agent' ? '智能体设定' : '缓存磁盘';
  const activeSubtitle = activeTab === 'model'
    ? '配置 API 中转站与模型参数'
    : activeTab === 'agent'
      ? '定义智能体的角色、身份与核心能力'
      : '管理本地项目历史与浏览器存储占用';

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
                {activeTab === 'cache' && (
                  <>
                    <h3 className="text-3xl font-black text-gray-900 dark:text-white">缓存磁盘</h3>
                    <p className="text-base text-gray-500 mt-2">管理本地项目历史与浏览器存储占用</p>
                  </>
                )}
                <h3 className={`text-3xl font-black text-gray-900 dark:text-white ${activeTab === 'cache' ? 'hidden' : ''}`}>
                  {activeTab === 'model' ? '模型配置' : '智能体设定'}
                </h3>
                <p className={`text-base text-gray-500 mt-2 ${activeTab === 'cache' ? 'hidden' : ''}`}>
                  {activeTab === 'model' ? '配置 API 中转站与模型参数' : '定义智能体的角色、身份与核心能力'}
                </p>
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
                  {/* Volcengine Ark / Seedance Config */}
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
                          <h4 className={`text-lg font-black ${platoEnabled ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>柏拉图 API 中转站 (推荐)</h4>
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
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-gray-500 flex items-center gap-2"><Globe className="w-4 h-4" /> API 节点地址</label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {['https://api.bltcy.ai', 'https://api.gptbest.vip', 'https://hk-api.gptbest.vip'].map(url => (
                              <button
                                key={url}
                                onClick={() => setPlatoBaseUrl(url)}
                              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${platoBaseUrl === url ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500'}`}
                              >
                                {url.includes('bltcy') ? '主站节点' : url.includes('hk') ? '香港节点' : '美国节点'}
                              </button>
                            ))}
                          </div>
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
                          <p className="text-[10px] text-gray-500">支持多 Key 轮询，请使用逗号或换行分隔。</p>
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

                  {/* Right Config */}
                  <div className={`p-7 lg:p-8 rounded-3xl border transition-all ${rightEnabled ? 'bg-white dark:bg-white/5 border-amber-200 dark:border-amber-500/30' : 'bg-gray-50/50 dark:bg-black/20 border-gray-200 dark:border-white/5 opacity-80'}`}>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-2xl ${rightEnabled ? 'bg-amber-100 text-amber-600' : 'bg-gray-200 text-gray-500'}`}>
                          <Sparkles className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className={`text-lg font-black ${rightEnabled ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>Right Code API 中转站</h4>
                          <p className="text-xs text-gray-500 mt-0.5">绘图接口统一入口，支持聊天与 OpenAI 原生图片生成接口</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setRightEnabled(!rightEnabled)}
                        className={`relative w-12 h-6 rounded-full transition-colors ${rightEnabled ? 'bg-amber-500' : 'bg-gray-300'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${rightEnabled ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>

                    {rightEnabled && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-gray-500 flex items-center gap-2"><Globe className="w-4 h-4" /> API 节点地址</label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            <button
                              onClick={() => setRightBaseUrl(DEFAULT_RIGHT_BASE_URL)}
                              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${rightBaseUrl === DEFAULT_RIGHT_BASE_URL ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500'}`}
                            >
                              Right 绘图主站
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-gray-500 flex items-center gap-2"><Key className="w-4 h-4" /> API Key</label>
                          <div className="relative">
                            <textarea
                              value={rightApiKey}
                              onChange={(e) => setRightApiKey(e.target.value)}
                              rows={4}
                              style={{ WebkitTextSecurity: isRightKeyVisible ? 'none' : 'disc' } as React.CSSProperties}
                              className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-5 py-4 text-base focus:ring-2 focus:ring-amber-500/20 outline-none font-mono resize-none"
                              placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                            />
                            <button onClick={() => setIsRightKeyVisible(!isRightKeyVisible)} className="absolute right-3 top-3 text-gray-400">
                              {isRightKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <p className="text-[10px] text-gray-500">支持多 Key 轮询，请使用逗号或换行分隔。</p>
                        </div>
                        <div className="flex items-center justify-between gap-4 mt-2">
                           <div className="flex-1">
                             {rightTestStatus !== 'idle' && (
                                <span className={`text-xs font-bold ${rightTestStatus === 'success' ? 'text-green-500' : rightTestStatus === 'testing' ? 'text-blue-500' : 'text-red-500'}`}>
                                 {rightTestStatus === 'success' ? '连接成功' : rightTestStatus === 'testing' ? '正在自动测试...' : rightTestMessage}
                               </span>
                             )}
                           </div>
                           <button
                             onClick={handleTestRight}
                             disabled={rightTestStatus === 'testing'}
                             className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-amber-50 dark:hover:bg-amber-500/10 text-gray-500 hover:text-amber-600 text-sm font-bold transition-all border border-gray-200 dark:border-white/10 min-w-[104px] flex items-center justify-center"
                           >
                             {rightTestStatus === 'testing' ? <RefreshCw className="w-3 h-3 animate-spin" /> : '测试连接'}
                           </button>
                        </div>
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
                        onClick={() => setYunwuEnabled(!yunwuEnabled)}
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
              ) : (
                <div className="space-y-8 max-w-3xl">
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
                    '确认连接成功后点击“保存配置”，模特工厂、AI 创意视频、玩偶工厂和创意中心会共用这套配置。'
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
