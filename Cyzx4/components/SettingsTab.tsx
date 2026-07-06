import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  Check,
  AlertTriangle,
  Eye,
  EyeOff,
  Globe,
  Key,
  RefreshCw,
  Zap,
  Cloud,
  Shield,
  Sparkles,
  Send,
  MessageCircle,
  Image as ImageIcon,
  Copy,
  CheckCircle2,
  Trash2,
  X,
  Cpu
} from 'lucide-react';
import { resolveRuntimeModelId } from '../utils/apiHelpers';

// ==================== 配置常量 ====================
const DEFAULT_BASE_URL = 'https://yunwu.ai';
const DEFAULT_PLATO_BASE_URL = 'https://api.apilio.ai';
const DEFAULT_MODEL = 'gemini-3-pro-preview';

// 可用模型列表 - 只保留常用的三个模型
const AVAILABLE_MODELS = [
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', description: '最新最强的Pro模型', badge: '推荐', type: 'text' },
  { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite', description: '快速响应模型', badge: '快速', type: 'text' },
  { id: 'gemini-3.1-flash-image-preview', name: 'Banana 2 (3.1 Flash)', description: '最新快速图像生成模型', badge: '推荐', type: 'image' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: '提示词润色同款模型', badge: '稳定', type: 'text' },
  { id: 'gpt-image-2', name: 'Imagen 2.0', description: '极致写实商业精修', badge: 'New', type: 'image' },
];

// ==================== 类型定义 ====================
interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  images?: string[];
  timestamp: number;
}

// ==================== API 客户端 (简化版) ====================
const sendToYunwuApi = async (
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  images: { base64: string; mimeType: string }[] = [],
  isPlato: boolean = false
): Promise<{ text: string; images?: string[] }> => {
  const runtimeModel = resolveRuntimeModelId(model, { isYunwu: true, isPlato });
  const url = `${baseUrl}/v1beta/models/${runtimeModel}:generateContent?key=${apiKey}`;

  const parts: any[] = [];
  images.forEach(img => {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
  });
  parts.push({ text: prompt });

  const response = await fetch(url, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 1, maxOutputTokens: 8192 }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `HTTP Error ${response.status}`);
  }

  const data = await response.json();
  const result: { text: string; images?: string[] } = { text: '' };
  const responseParts = data.candidates?.[0]?.content?.parts || [];

  for (const part of responseParts) {
    if (part.text) result.text += part.text;
    if (part.inlineData) {
      if (!result.images) result.images = [];
      result.images.push(`data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`);
    }
  }
  return result;
};

// 文件转Base64
const fileToBase64 = (file: File): Promise<{ base64: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve({ base64, mimeType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// ==================== 主组件 ====================
const SettingsTab: React.FC = () => {
  // 当前视图: 'config' 或 'chat'
  const [currentView, setCurrentView] = useState<'config' | 'chat'>('config');

  // ========== 原生 Gemini API Key ==========
  const [nativeApiKey, setNativeApiKey] = useState('');
  const [isNativeKeyVisible, setIsNativeKeyVisible] = useState(false);
  const [nativeStatus, setNativeStatus] = useState<'idle' | 'success' | 'empty'>('idle');
  const [nativeEnabled, setNativeEnabled] = useState(true);

  // ========== 云雾API配置 ==========
  const [yunwuApiKey, setYunwuApiKey] = useState('');
  const [yunwuBaseUrl, setYunwuBaseUrl] = useState(DEFAULT_BASE_URL);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [isYunwuKeyVisible, setIsYunwuKeyVisible] = useState(false);
  const [yunwuStatus, setYunwuStatus] = useState<'idle' | 'success' | 'empty'>('idle');
  const [yunwuEnabled, setYunwuEnabled] = useState(true);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  // ========== 柏拉图 API 配置 ==========
  const [platoApiKey, setPlatoApiKey] = useState('');
  const [platoBaseUrl, setPlatoBaseUrl] = useState(DEFAULT_PLATO_BASE_URL);
  const [isPlatoKeyVisible, setIsPlatoKeyVisible] = useState(false);
  const [platoStatus, setPlatoStatus] = useState<'idle' | 'success' | 'empty'>('idle');
  const [platoEnabled, setPlatoEnabled] = useState(false);
  const [platoTestStatus, setPlatoTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [platoTestMessage, setPlatoTestMessage] = useState('');

  // 聊天状态
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [uploadedImages, setUploadedImages] = useState<{ base64: string; mimeType: string; preview: string }[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 加载配置
  useEffect(() => {
    // 原生 API Key
    const savedNativeKey = localStorage.getItem('user_api_key');
    const savedNativeEnabled = localStorage.getItem('native_enabled');
    if (savedNativeKey) {
      setNativeApiKey(savedNativeKey);
      setNativeStatus('success');
    } else {
      setNativeStatus('empty');
    }
    setNativeEnabled(savedNativeEnabled !== 'false'); // Default to true

    // 云雾API配置
    const savedYunwuKey = localStorage.getItem('yunwu_api_key');
    const savedYunwuUrl = localStorage.getItem('yunwu_base_url');
    const savedModel = localStorage.getItem('yunwu_default_model');
    const savedYunwuEnabled = localStorage.getItem('yunwu_enabled');

    if (savedYunwuUrl) setYunwuBaseUrl(savedYunwuUrl);
    if (savedYunwuKey) setYunwuApiKey(savedYunwuKey);
    if (savedModel) setSelectedModel(savedModel);

    setYunwuEnabled(savedYunwuEnabled !== 'false'); // Default to true
    setYunwuStatus(savedYunwuKey ? 'success' : 'empty');

    // 柏拉图 API 配置
    const savedPlatoKey = localStorage.getItem('plato_api_key');
    const savedPlatoEnabled = localStorage.getItem('plato_enabled');

    setPlatoBaseUrl(DEFAULT_PLATO_BASE_URL);
    if (savedPlatoKey) setPlatoApiKey(savedPlatoKey);
    setPlatoEnabled(savedPlatoEnabled === 'true'); // Default to false
    setPlatoStatus(savedPlatoKey ? 'success' : 'empty');
  }, []);

  // Toggle Handlers
  const toggleNative = () => {
    const newState = !nativeEnabled;
    setNativeEnabled(newState);
    localStorage.setItem('native_enabled', String(newState));
  };

  const toggleYunwu = () => {
    const newState = !yunwuEnabled;
    setYunwuEnabled(newState);
    localStorage.setItem('yunwu_enabled', String(newState));
  };

  const togglePlato = () => {
    const newState = !platoEnabled;
    setPlatoEnabled(newState);
    localStorage.setItem('plato_enabled', String(newState));
  };

  // 保存原生 API Key
  const handleSaveNativeKey = () => {
    if (!nativeApiKey.trim()) {
      localStorage.removeItem('user_api_key');
      setNativeStatus('empty');
      return;
    }
    localStorage.setItem('user_api_key', nativeApiKey.trim());
    localStorage.setItem('native_enabled', String(nativeEnabled));
    setNativeStatus('success');
  };

  // 保存云雾API配置
  const handleSaveYunwuConfig = () => {
    if (!yunwuApiKey.trim()) {
      setYunwuStatus('empty');
      return;
    }
    localStorage.setItem('yunwu_api_key', yunwuApiKey.trim());
    localStorage.setItem('yunwu_base_url', yunwuBaseUrl.trim() || DEFAULT_BASE_URL);
    localStorage.setItem('yunwu_default_model', selectedModel);
    localStorage.setItem('yunwu_enabled', String(yunwuEnabled));
    setYunwuStatus('success');
  };

  // 测试云雾API连接
  const handleTestConnection = async () => {
    if (!yunwuApiKey.trim()) {
      setTestStatus('error');
      setTestMessage('请先输入 API Key');
      return;
    }
    setTestStatus('testing');
    setTestMessage('正在测试...');

    try {
      // 优化：测试时直接使用输入框中的第一个 Key 和 URL，
      // 模型固定为 gemini-3.1-flash-lite-preview (最便宜/快速)
      const testModel = 'gemini-3.1-flash-lite-preview';
      const firstKey = yunwuApiKey.split(/[,\n]/).map(k => k.trim()).filter(k => k !== "")[0];

      if (!firstKey) {
        throw new Error('请输入有效的 API Key');
      }

      const result = await sendToYunwuApi(
        yunwuBaseUrl.trim() || DEFAULT_BASE_URL,
        firstKey,
        testModel,
        'Say OK',
        [],
        false
      );
      setTestStatus(result.text ? 'success' : 'error');
      setTestMessage(result.text ? '✅ 连接成功!' : '❌ 无响应');
    } catch (error) {
      setTestStatus('error');
      setTestMessage(`❌ ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };
  // 保存柏拉图 API 配置
  const handleSavePlatoConfig = () => {
    if (!platoApiKey.trim()) {
      setPlatoStatus('empty');
      return;
    }
    localStorage.setItem('plato_api_key', platoApiKey.trim());
    localStorage.setItem('plato_base_url', DEFAULT_PLATO_BASE_URL);
    localStorage.setItem('plato_enabled', String(platoEnabled));
    setPlatoStatus('success');
  };

  // 测试柏拉图 API 连接
  const handleTestPlatoConnection = async () => {
    if (!platoApiKey.trim()) {
      setPlatoTestStatus('error');
      setPlatoTestMessage('请先输入 API Key');
      return;
    }
    setPlatoTestStatus('testing');
    setPlatoTestMessage('正在测试...');

    try {
      // 优化：测试时直接使用输入框中的 Key 和 URL，而不是从 getApiConfig 读取，
      // 这样用户在保存前就能测试。
      // 模型固定为 gemini-3.1-flash-lite-preview (用户指定，最便宜)
      const testModel = 'gemini-3.1-flash-lite-preview';
      
      // 处理多 Key 轮询场景下的首个 Key
      const firstKey = platoApiKey.split(/[,\n]/).map(k => k.trim()).filter(k => k !== "")[0];

      if (!firstKey) {
          throw new Error('请输入有效的 API Key');
      }

      const result = await sendToYunwuApi(
        DEFAULT_PLATO_BASE_URL,
        firstKey,
        testModel,
        'Say OK',
        [],
        true
      );
      setPlatoTestStatus(result.text ? 'success' : 'error');
      setPlatoTestMessage(result.text ? '✅ 连接成功!' : '❌ 无响应');
    } catch (error) {
      setPlatoTestStatus('error');
      setPlatoTestMessage(`❌ ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 图片上传
  const handleImageUpload = async (files: FileList | null) => {
    if (!files) return;
    const newImages: { base64: string; mimeType: string; preview: string }[] = [];
    for (let i = 0; i < Math.min(files.length, 5 - uploadedImages.length); i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        const { base64, mimeType } = await fileToBase64(file);
        newImages.push({ base64, mimeType, preview: URL.createObjectURL(file) });
      }
    }
    setUploadedImages(prev => [...prev, ...newImages].slice(0, 5));
  };

  // 发送消息
  const handleSend = async () => {
    if (!inputText.trim() && uploadedImages.length === 0) return;
    if (!yunwuApiKey.trim()) {
      setTestMessage('请先配置云雾API Key');
      setCurrentView('config');
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText,
      images: uploadedImages.map(img => img.preview),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    const imagesToSend = [...uploadedImages];
    setUploadedImages([]);
    setIsGenerating(true);

    try {
      const result = await sendToYunwuApi(
        yunwuBaseUrl.trim() || DEFAULT_BASE_URL,
        yunwuApiKey.trim(),
        selectedModel,
        userMessage.content,
        imagesToSend.map(img => ({ base64: img.base64, mimeType: img.mimeType })),
        false
      );

      const modelMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: result.text,
        images: result.images,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, modelMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: `❌ 错误: ${error instanceof Error ? error.message : '未知错误'}`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsGenerating(false);
    }
  };

  // 复制文本
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* 标题和Tab切换 */}
        <div className="bg-pastel-card p-6 rounded-2xl border border-pastel-border shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-pastel-pink to-pastel-highlight rounded-xl shadow-sm">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-pastel-text">设置 (Settings)</h2>
                <p className="text-sm text-pastel-muted">API Configuration & Testing</p>
              </div>
            </div>

            {/* Tab 切换器 */}
            <div className="flex bg-pastel-bg rounded-xl p-1 border border-pastel-border">
              <button
                onClick={() => setCurrentView('config')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${currentView === 'config'
                  ? 'bg-pastel-pink text-pastel-text shadow-sm'
                  : 'text-pastel-muted hover:text-pastel-text'
                  }`}
              >
                <Shield className="w-4 h-4" />
                配置
              </button>
              <button
                onClick={() => setCurrentView('chat')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${currentView === 'chat'
                  ? 'bg-pastel-pink text-pastel-text shadow-sm'
                  : 'text-pastel-muted hover:text-pastel-text'
                  }`}
              >
                <MessageCircle className="w-4 h-4" />
                对话测试
              </button>
            </div>
          </div>
        </div>

        {currentView === 'config' ? (
          /* ==================== 配置面板 ==================== */
          <div className="space-y-6">

            {/* 当前API状态指示器 */}
            <div className={`p-4 rounded-xl border flex items-center gap-3 ${platoStatus === 'success' && platoEnabled
                ? 'bg-rose-50 border-rose-200'
                : yunwuStatus === 'success' && yunwuEnabled
                  ? 'bg-purple-50 border-purple-200'
                  : nativeStatus === 'success' && nativeEnabled
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-amber-50 border-amber-200'
              }`}>
              <div className={`p-2 rounded-lg ${platoStatus === 'success' && platoEnabled
                  ? 'bg-rose-100'
                  : yunwuStatus === 'success' && yunwuEnabled
                    ? 'bg-purple-100'
                    : nativeStatus === 'success' && nativeEnabled
                      ? 'bg-blue-100'
                      : 'bg-amber-100'
                }`}>
                {platoStatus === 'success' && platoEnabled ? (
                  <Zap className="w-5 h-5 text-rose-600" />
                ) : yunwuStatus === 'success' && yunwuEnabled ? (
                  <Cloud className="w-5 h-5 text-purple-600" />
                ) : nativeStatus === 'success' && nativeEnabled ? (
                  <Cpu className="w-5 h-5 text-blue-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                )}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-semibold ${platoStatus === 'success' && platoEnabled
                    ? 'text-rose-700'
                    : yunwuStatus === 'success' && yunwuEnabled
                      ? 'text-purple-700'
                      : nativeStatus === 'success' && nativeEnabled
                        ? 'text-blue-700'
                        : 'text-amber-700'
                  }`}>
                  {platoStatus === 'success' && platoEnabled
                    ? '⚡️ 创意中心正在使用：柏拉图 API 中转站 (Plato)'
                    : yunwuStatus === 'success' && yunwuEnabled
                      ? '🟣 创意中心正在使用：云雾API 中转站'
                      : nativeStatus === 'success' && nativeEnabled
                        ? '🔵 创意中心正在使用：Google Gemini 原生 API'
                        : '⚠️ 未配置API或已禁用，请启用以使用AI功能'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {platoStatus === 'success' && platoEnabled
                    ? `Base URL: ${DEFAULT_PLATO_BASE_URL}`
                    : yunwuStatus === 'success' && yunwuEnabled
                      ? `Base URL: ${yunwuBaseUrl || DEFAULT_BASE_URL}`
                      : nativeStatus === 'success' && nativeEnabled
                        ? 'API Key 已配置'
                        : '请在下方配置任意一个 API。针对您的需求，推荐使用柏拉图 API。'}
                </p>
              </div>
              {((platoStatus === 'success' && platoEnabled) || (yunwuStatus === 'success' && yunwuEnabled) || (nativeStatus === 'success' && nativeEnabled)) && (
                <CheckCircle2 className={`w-5 h-5 ${platoStatus === 'success' && platoEnabled ? 'text-rose-500' : yunwuStatus === 'success' && yunwuEnabled ? 'text-purple-500' : 'text-blue-500'}`} />
              )}
            </div>

            {/* ========== 1. 原生 Google Gemini API Key ========== */}
            <div className={`bg-pastel-card p-6 rounded-2xl border shadow-sm transition-all ${!nativeEnabled ? 'opacity-70 border-gray-200 bg-gray-50' : 'border-pastel-border'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${nativeEnabled ? 'bg-blue-100' : 'bg-gray-200'}`}>
                    <Cpu className={`w-5 h-5 ${nativeEnabled ? 'text-blue-600' : 'text-gray-500'}`} />
                  </div>
                  <div>
                    <h3 className={`text-lg font-bold ${nativeEnabled ? 'text-pastel-text' : 'text-gray-500'}`}>Google Gemini 原生 API</h3>
                    <p className="text-xs text-pastel-muted">用于创意中心的核心 AI 功能</p>
                  </div>
                </div>
                {/* Toggle Switch */}
                <button
                  onClick={toggleNative}
                  className={`relative w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${nativeEnabled ? 'bg-blue-500' : 'bg-gray-300'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${nativeEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {nativeEnabled && (
                <>
                  <p className="text-pastel-muted mb-6 text-sm leading-relaxed border-l-4 border-blue-300 pl-4 py-2 bg-blue-50/50 rounded-r-lg">
                    请输入您的 Google Gemini API Key 以启用所有 AI 功能。您的密钥将安全地存储在浏览器的本地存储中，不会被上传到其他服务器。
                  </p>

                  <div className="space-y-4">
                    <label className="block text-sm font-semibold text-pastel-text">Google Gemini API Key</label>
                    <div className="relative">
                      <input
                        type={isNativeKeyVisible ? 'text' : 'password'}
                        value={nativeApiKey}
                        onChange={(e) => setNativeApiKey(e.target.value)}
                        placeholder="AIzaSy..."
                        className="w-full bg-pastel-input border border-pastel-border rounded-xl py-3 pl-4 pr-12 text-pastel-text focus:border-pastel-pink focus:ring-2 focus:ring-pastel-pink/20 outline-none shadow-sm transition-all font-mono text-sm"
                      />
                      <button
                        onClick={() => setIsNativeKeyVisible(!isNativeKeyVisible)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-pastel-muted hover:text-pastel-highlight transition-colors p-1 rounded-lg hover:bg-pastel-pink/10"
                      >
                        {isNativeKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {nativeStatus === 'success' && (
                        <span className="flex items-center gap-1.5 text-sm font-medium text-green-600 bg-green-50 px-3 py-2 rounded-full border border-green-200">
                          <Check className="w-4 h-4" /> ✅ 已保存
                        </span>
                      )}
                      {nativeStatus === 'empty' && (
                        <span className="flex items-center gap-1.5 text-sm font-medium text-amber-600 bg-amber-50 px-3 py-2 rounded-full border border-amber-200">
                          <AlertTriangle className="w-4 h-4" /> ⚠️ 未配置
                        </span>
                      )}
                    </div>
                    <button
                      onClick={handleSaveNativeKey}
                      className="flex items-center gap-2 px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl shadow-sm transition-all"
                    >
                      <Save className="w-4 h-4" />
                      保存
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* ========== 2. 云雾API配置 ========== */}
            <div className={`bg-pastel-card p-6 rounded-2xl border shadow-sm transition-all ${!yunwuEnabled ? 'opacity-70 border-gray-200 bg-gray-50' : 'border-pastel-border'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${yunwuEnabled ? 'bg-purple-100' : 'bg-gray-200'}`}>
                    <Cloud className={`w-5 h-5 ${yunwuEnabled ? 'text-purple-600' : 'text-gray-500'}`} />
                  </div>
                  <div>
                    <h3 className={`text-lg font-bold ${yunwuEnabled ? 'text-pastel-text' : 'text-gray-500'}`}>云雾API 中转站</h3>
                    <p className="text-xs text-pastel-muted">Yunwu API Proxy for Gemini</p>
                  </div>
                </div>
                {/* Toggle Switch */}
                <button
                  onClick={toggleYunwu}
                  className={`relative w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${yunwuEnabled ? 'bg-purple-500' : 'bg-gray-300'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${yunwuEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {yunwuEnabled && (
                <>
                  <p className="text-pastel-muted mb-6 text-sm leading-relaxed border-l-4 border-purple-300 pl-4 py-2 bg-purple-50/50 rounded-r-lg">
                    配置云雾API中转站以使用 Gemini AI 功能。支持自定义 Base URL 和多种模型选择。
                  </p>

                  <div className="space-y-5">
                    {/* Base URL */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-semibold text-pastel-text">
                        <Globe className="w-4 h-4 text-purple-500" />
                        API Base URL
                        <span className="text-xs font-normal text-pastel-muted">(中转站地址)</span>
                      </label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        <button
                          onClick={() => setYunwuBaseUrl('https://yunwu.ai')}
                          className={`px-3 py-1 text-xs rounded-full border transition-all ${yunwuBaseUrl === 'https://yunwu.ai' ? 'bg-purple-100 border-purple-300 text-purple-700' : 'bg-white border-gray-200 text-gray-600 hover:border-purple-200'}`}
                        >
                          主站节点
                        </button>
                        <button
                          onClick={() => setYunwuBaseUrl('https://api.apiplus.org')}
                          className={`px-3 py-1 text-xs rounded-full border transition-all ${yunwuBaseUrl === 'https://api.apiplus.org' ? 'bg-purple-100 border-purple-300 text-purple-700' : 'bg-white border-gray-200 text-gray-600 hover:border-purple-200'}`}
                        >
                          CF站节点
                        </button>
                        <button
                          onClick={() => setYunwuBaseUrl('https://api3.wlai.vip')}
                          className={`px-3 py-1 text-xs rounded-full border transition-all ${yunwuBaseUrl === 'https://api3.wlai.vip' ? 'bg-purple-100 border-purple-300 text-purple-700' : 'bg-white border-gray-200 text-gray-600 hover:border-purple-200'}`}
                        >
                          国内节点
                        </button>
                        <button
                          onClick={() => setYunwuBaseUrl('https://api.zhongzhuan.chat')}
                          className={`px-3 py-1 text-xs rounded-full border transition-all ${yunwuBaseUrl === 'https://api.zhongzhuan.chat' ? 'bg-purple-100 border-purple-300 text-purple-700' : 'bg-white border-gray-200 text-gray-600 hover:border-purple-200'}`}
                        >
                          中转节点
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={yunwuBaseUrl}
                          onChange={(e) => setYunwuBaseUrl(e.target.value)}
                          placeholder="https://yunwu.ai"
                          className="w-full bg-pastel-input border border-pastel-border rounded-xl py-3 pl-4 pr-12 text-pastel-text focus:border-purple-400 focus:ring-2 focus:ring-purple-200 outline-none shadow-sm transition-all font-mono text-sm"
                        />
                        <button
                          onClick={() => { setYunwuBaseUrl(DEFAULT_BASE_URL); }}
                          title="重置为默认值"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-pastel-muted hover:text-purple-500 transition-colors p-1 rounded-lg hover:bg-purple-100"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-pastel-muted pl-1">
                        默认: <code className="bg-pastel-input px-1.5 py-0.5 rounded text-purple-600">{DEFAULT_BASE_URL}</code>
                      </p>
                    </div>

                    {/* API Key */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-semibold text-pastel-text">
                        <Key className="w-4 h-4 text-purple-500" />
                        API Key
                        <span className="text-xs font-normal text-pastel-muted">(密钥)</span>
                        <span className="text-red-400 text-xs">*必填</span>
                      </label>
                      <div className="relative">
                        <textarea
                          value={yunwuApiKey}
                          onChange={(e) => setYunwuApiKey(e.target.value)}
                          placeholder="sk-key1,&#10;sk-key2"
                          rows={4}
                          style={{ WebkitTextSecurity: isYunwuKeyVisible ? 'none' : 'disc' } as React.CSSProperties}
                          className="w-full bg-pastel-input border border-pastel-border rounded-xl py-3 pl-4 pr-12 text-pastel-text focus:border-purple-400 focus:ring-2 focus:ring-purple-200 outline-none shadow-sm transition-all font-mono text-sm resize-none"
                        />
                        <button
                          onClick={() => setIsYunwuKeyVisible(!isYunwuKeyVisible)}
                          className="absolute right-3 top-3 text-pastel-muted hover:text-purple-500 transition-colors p-1 rounded-lg hover:bg-purple-100"
                        >
                          {isYunwuKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-[10px] text-pastel-muted mt-1 px-1">
                        支持输出多个 Key，请使用<span className="text-purple-500 font-bold mx-0.5">逗号</span>或<span className="text-purple-500 font-bold mx-0.5">换行</span>分隔。程序将自动轮询。
                      </p>
                    </div>

                    {/* 默认模型选择已根据用户要求隐藏，保持与柏拉图一致 */}
                  </div>

                  {/* 分隔线 */}
                  <div className="my-6 border-t border-pastel-border/50"></div>

                  {/* 状态与操作 */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      {yunwuStatus === 'success' && (
                        <span className="flex items-center gap-1.5 text-sm font-medium text-green-600 bg-green-50 px-3 py-2 rounded-full border border-green-200">
                          <Check className="w-4 h-4" /> 配置已保存
                        </span>
                      )}
                      {yunwuStatus === 'empty' && (
                        <span className="flex items-center gap-1.5 text-sm font-medium text-amber-600 bg-amber-50 px-3 py-2 rounded-full border border-amber-200">
                          <AlertTriangle className="w-4 h-4" /> 未配置
                        </span>
                      )}
                      {testStatus !== 'idle' && (
                        <span className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-full border ${testStatus === 'testing' ? 'text-blue-600 bg-blue-50 border-blue-200' :
                          testStatus === 'success' ? 'text-green-600 bg-green-50 border-green-200' :
                            'text-red-600 bg-red-50 border-red-200'
                          }`}>
                          {testStatus === 'testing' && <RefreshCw className="w-4 h-4 animate-spin" />}
                          {testMessage}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleTestConnection}
                        disabled={testStatus === 'testing'}
                        className="flex items-center gap-2 px-5 py-2.5 bg-pastel-input hover:bg-pastel-border/50 text-pastel-text font-medium rounded-xl shadow-sm transition-all border border-pastel-border disabled:opacity-50"
                      >
                        <RefreshCw className={`w-4 h-4 ${testStatus === 'testing' ? 'animate-spin' : ''}`} />
                        测试连接
                      </button>
                      <button
                        onClick={handleSaveYunwuConfig}
                        className="flex items-center gap-2 px-6 py-2.5 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-xl shadow-sm transition-all"
                      >
                        <Save className="w-4 h-4" />
                        保存配置
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* ========== 3. 柏拉图 API 中转站 ========== */}
            <div className={`bg-pastel-card p-6 rounded-2xl border shadow-sm transition-all ${!platoEnabled ? 'opacity-70 border-gray-200 bg-gray-50' : 'border-pastel-border'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${platoEnabled ? 'bg-rose-100' : 'bg-gray-200'}`}>
                    <Zap className={`w-5 h-5 ${platoEnabled ? 'text-rose-600' : 'text-gray-500'}`} />
                  </div>
                  <div>
                    <h3 className={`text-lg font-bold ${platoEnabled ? 'text-pastel-text' : 'text-gray-500'}`}>柏拉图 API 中转站 (推荐)</h3>
                    <p className="text-xs text-pastel-muted">Plato API Proxy for Gemini</p>
                  </div>
                </div>
                {/* Toggle Switch */}
                <button
                  onClick={togglePlato}
                  className={`relative w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${platoEnabled ? 'bg-rose-500' : 'bg-gray-300'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${platoEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {platoEnabled && (
                <>
                  <p className="text-pastel-muted mb-6 text-sm leading-relaxed border-l-4 border-rose-300 pl-4 py-2 bg-rose-50/50 rounded-r-lg">
                    配置柏拉图 API 中转站。支持多个节点（主站、美国、香港），具备优秀的稳定性。
                  </p>

                  <div className="space-y-5">
                    {/* Base URL */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-semibold text-pastel-text">
                        <Globe className="w-4 h-4 text-rose-500" />
                        API 节点地址
                      </label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        <button
                          onClick={() => setPlatoBaseUrl(DEFAULT_PLATO_BASE_URL)}
                          className={`px-3 py-1 text-xs rounded-full border transition-all ${platoBaseUrl === DEFAULT_PLATO_BASE_URL ? 'bg-rose-100 border-rose-300 text-rose-700' : 'bg-white border-gray-200 text-gray-600 hover:border-rose-200'}`}
                        >
                          主站节点
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={platoBaseUrl}
                          readOnly
                          placeholder={DEFAULT_PLATO_BASE_URL}
                          className="w-full bg-pastel-input border border-pastel-border rounded-xl py-3 pl-4 pr-12 text-pastel-text focus:border-rose-400 focus:ring-2 focus:ring-rose-200 outline-none shadow-sm transition-all font-mono text-sm"
                        />
                      </div>
                    </div>

                    {/* API Key */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-semibold text-pastel-text">
                        <Key className="w-4 h-4 text-rose-500" />
                        API Key
                        <span className="text-red-400 text-xs">*必填</span>
                      </label>
                      <div className="relative">
                        <textarea
                          value={platoApiKey}
                          onChange={(e) => setPlatoApiKey(e.target.value)}
                          placeholder="sk-..."
                          rows={4}
                          style={{ WebkitTextSecurity: isPlatoKeyVisible ? 'none' : 'disc' } as React.CSSProperties}
                          className="w-full bg-pastel-input border border-pastel-border rounded-xl py-3 pl-4 pr-12 text-pastel-text focus:border-rose-400 focus:ring-2 focus:ring-rose-200 outline-none shadow-sm transition-all font-mono text-sm resize-none"
                        />
                        <button
                          onClick={() => setIsPlatoKeyVisible(!isPlatoKeyVisible)}
                          className="absolute right-3 top-3 text-pastel-muted hover:text-rose-500 transition-colors p-1 rounded-lg hover:bg-rose-100"
                        >
                          {isPlatoKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-[10px] text-pastel-muted mt-1 px-1">
                        支持多 Key 轮询，请使用逗号或换行分隔。
                      </p>
                    </div>
                  </div>

                  <div className="my-6 border-t border-pastel-border/50"></div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      {platoStatus === 'success' && (
                        <span className="flex items-center gap-1.5 text-sm font-medium text-green-600 bg-green-50 px-3 py-2 rounded-full border border-green-200">
                          <Check className="w-4 h-4" /> 配置已保存
                        </span>
                      )}
                      {platoTestStatus !== 'idle' && (
                        <span className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-full border ${platoTestStatus === 'testing' ? 'text-blue-600 bg-blue-50 border-blue-200' :
                          platoTestStatus === 'success' ? 'text-green-600 bg-green-50 border-green-200' :
                            'text-red-600 bg-red-50 border-red-200'
                          }`}>
                          {platoTestStatus === 'testing' && <RefreshCw className="w-4 h-4 animate-spin" />}
                          {platoTestMessage}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleTestPlatoConnection}
                        disabled={platoTestStatus === 'testing'}
                        className="flex items-center gap-2 px-5 py-2.5 bg-pastel-input hover:bg-pastel-border/50 text-pastel-text font-medium rounded-xl shadow-sm transition-all border border-pastel-border disabled:opacity-50"
                      >
                        <RefreshCw className={`w-4 h-4 ${platoTestStatus === 'testing' ? 'animate-spin' : ''}`} />
                        测试连接
                      </button>
                      <button
                        onClick={handleSavePlatoConfig}
                        className="flex items-center gap-2 px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl shadow-sm transition-all"
                      >
                        <Save className="w-4 h-4" />
                        保存配置
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* 使用说明 */}
            <div className="bg-pastel-card/70 p-6 rounded-2xl border border-pastel-border/50">
              <h3 className="text-lg font-semibold text-pastel-text mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-pastel-highlight" />
                说明
              </h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm text-pastel-muted">
                <div className="flex gap-3 p-3 bg-blue-50/50 rounded-xl">
                  <Cpu className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-pastel-text">原生 Gemini API</strong>
                    <p className="text-xs mt-1">用于创意中心的核心功能（视觉策划、图像生成等）</p>
                  </div>
                </div>
                <div className="flex gap-3 p-3 bg-purple-50/50 rounded-xl">
                  <Cloud className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-pastel-text">云雾 API 中转</strong>
                    <p className="text-xs mt-1">可切换到「对话测试」标签页体验云雾API对话功能</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ==================== 对话面板 ==================== */
          <div className="bg-pastel-card rounded-2xl border border-pastel-border shadow-sm overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
            {/* 工具栏 */}
            <div className="flex items-center justify-between p-4 border-b border-pastel-border bg-pastel-bg/50">
              <div className="flex items-center gap-3">
                <Cloud className="w-5 h-5 text-purple-500" />
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="bg-pastel-input border border-pastel-border rounded-xl py-2 px-4 text-pastel-text text-sm focus:border-purple-400 outline-none"
                >
                  {AVAILABLE_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} {model.badge ? `[${model.badge}]` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => setMessages([])}
                className="flex items-center gap-2 px-4 py-2 text-pastel-muted hover:text-pastel-text hover:bg-pastel-input rounded-xl transition-all text-sm"
              >
                <Trash2 className="w-4 h-4" />
                清空对话
              </button>
            </div>

            {/* 消息区域 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="p-4 bg-purple-100 rounded-2xl mb-4">
                    <MessageCircle className="w-12 h-12 text-purple-500" />
                  </div>
                  <h3 className="text-xl font-semibold text-pastel-text mb-2">云雾API 对话测试</h3>
                  <p className="text-pastel-muted max-w-md">
                    输入文字或上传图片，使用云雾API与 Gemini 模型进行交互
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] ${msg.role === 'user'
                      ? 'bg-purple-100 text-pastel-text'
                      : 'bg-pastel-input border border-pastel-border text-pastel-text'
                      } rounded-2xl p-4`}>
                      {msg.images && msg.images.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {msg.images.map((img, i) => (
                            <img key={i} src={img} alt="" className="max-w-[200px] rounded-lg" />
                          ))}
                        </div>
                      )}
                      <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                      {msg.role === 'model' && (
                        <button
                          onClick={() => handleCopy(msg.content, msg.id)}
                          className="mt-2 flex items-center gap-1 text-xs text-pastel-muted hover:text-purple-500 transition-colors"
                        >
                          {copiedId === msg.id ? (
                            <><CheckCircle2 className="w-3 h-3" /> 已复制</>
                          ) : (
                            <><Copy className="w-3 h-3" /> 复制</>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}

              {isGenerating && (
                <div className="flex justify-start">
                  <div className="bg-pastel-input border border-pastel-border rounded-2xl p-4 flex items-center gap-3">
                    <RefreshCw className="w-5 h-5 text-purple-500 animate-spin" />
                    <span className="text-pastel-muted text-sm">正在生成...</span>
                  </div>
                </div>
              )}
            </div>

            {/* 输入区域 */}
            <div className="p-4 border-t border-pastel-border bg-pastel-bg/30">
              {uploadedImages.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {uploadedImages.map((img, i) => (
                    <div key={i} className="relative group">
                      <img src={img.preview} alt="" className="w-16 h-16 object-cover rounded-lg border border-pastel-border" />
                      <button
                        onClick={() => setUploadedImages(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-3">
                <label className="flex-shrink-0 p-3 bg-pastel-input hover:bg-pastel-border/50 rounded-xl cursor-pointer transition-all border border-pastel-border">
                  <ImageIcon className="w-5 h-5 text-pastel-muted" />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleImageUpload(e.target.files)}
                    className="hidden"
                  />
                </label>

                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="输入消息... (Shift+Enter 换行)"
                  rows={1}
                  className="flex-1 bg-pastel-input border border-pastel-border rounded-xl py-3 px-4 text-pastel-text placeholder-pastel-muted focus:border-purple-400 outline-none resize-none min-h-[48px] max-h-[200px]"
                />

                <button
                  onClick={handleSend}
                  disabled={isGenerating || (!inputText.trim() && uploadedImages.length === 0)}
                  className="flex-shrink-0 p-3 bg-purple-500 hover:bg-purple-600 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsTab;
