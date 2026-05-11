import React, { useState, useEffect } from 'react';
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
  Copy
} from 'lucide-react';
import { getApiConfig } from '../Cyzx4/utils/apiHelpers';

interface UnifiedSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'model' | 'agent';
}

const DEFAULT_BASE_URL = 'https://yunwu.ai';
const DEFAULT_MODEL = 'gemini-3-pro-preview';

const AVAILABLE_MODELS = [
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', description: '最新最强的Pro模型', badge: '推荐', type: 'text' },
  { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite', description: '快速响应模型', badge: '快速', type: 'text' },
  { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image', description: '图片生成模型', badge: '图像', type: 'image' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: '提示词润色同款模型', badge: '稳定', type: 'text' },
  { id: 'gpt-image-2', name: 'Imagen 2.0', description: '极致写实商业精修', badge: 'New', type: 'image' },
];

// ==================== API 客户端 (用于测试连接) ====================
const sendTestRequest = async (
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string
): Promise<{ text: string }> => {
  const url = `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 1, maxOutputTokens: 10 }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `HTTP Error ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return { text };
};

export const UnifiedSettingsModal: React.FC<UnifiedSettingsModalProps> = ({ isOpen, onClose, initialTab = 'model' }) => {
  const [activeTab, setActiveTab] = useState<'model' | 'agent'>(initialTab);

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

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  // Individual section test statuses
  const [platoTestStatus, setPlatoTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [platoTestMessage, setPlatoTestMessage] = useState('');
  
  const [yunwuTestStatus, setYunwuTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [yunwuTestMessage, setYunwuTestMessage] = useState('');

  const [nativeTestStatus, setNativeTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [nativeTestMessage, setNativeTestMessage] = useState('');

  useEffect(() => {
    if (!isOpen) return;

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
    setNativeEnabled(savedNativeEnabled !== 'false');

    const savedYunwuKey = localStorage.getItem('yunwu_api_key');
    const savedYunwuUrl = localStorage.getItem('yunwu_base_url');
    const savedModel = localStorage.getItem('yunwu_default_model');
    const savedYunwuEnabled = localStorage.getItem('yunwu_enabled');
    if (savedYunwuKey) setYunwuApiKey(savedYunwuKey);
    if (savedYunwuUrl) setYunwuBaseUrl(savedYunwuUrl);
    if (savedModel) setSelectedModel(savedModel);
    setYunwuEnabled(savedYunwuEnabled !== 'false');

    const savedPlatoKey = localStorage.getItem('plato_api_key');
    const savedPlatoUrl = localStorage.getItem('plato_base_url');
    const savedPlatoEnabled = localStorage.getItem('plato_enabled');
    if (savedPlatoKey) setPlatoApiKey(savedPlatoKey);
    if (savedPlatoUrl) setPlatoBaseUrl(savedPlatoUrl);
    setPlatoEnabled(savedPlatoEnabled === 'true');
  }, [isOpen]);

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
      const res = await sendTestRequest(yunwuBaseUrl || DEFAULT_BASE_URL, key, selectedModel, 'Say OK');
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
          className="relative w-full max-w-5xl h-[85vh] bg-white dark:bg-[#121212] rounded-[2rem] shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden flex flex-col md:flex-row"
        >
          {/* Sidebar */}
          <div className="w-full md:w-64 bg-gray-50/50 dark:bg-black/20 border-r border-gray-200 dark:border-white/5 p-6 flex flex-col gap-2 shrink-0">
            <div className="flex items-center gap-3 mb-8 px-2">
              <div className="w-10 h-10 rounded-2xl bg-brand-orange flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900 dark:text-white leading-tight">全局设置</h2>
                <p className="text-[10px] text-gray-500">XcAI Agent Settings</p>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('model')}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${activeTab === 'model' ? 'bg-white dark:bg-white/10 shadow-md text-brand-orange' : 'text-gray-500 hover:bg-gray-200/50 dark:hover:bg-white/5'}`}
            >
              <Cpu className="w-5 h-5" />
              <span className="text-sm font-bold">模型配置</span>
            </button>

            <button
              onClick={() => setActiveTab('agent')}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${activeTab === 'agent' ? 'bg-white dark:bg-white/10 shadow-md text-brand-orange' : 'text-gray-500 hover:bg-gray-200/50 dark:hover:bg-white/5'}`}
            >
              <Bot className="w-5 h-5" />
              <span className="text-sm font-bold">智能体设定</span>
            </button>

            <div className="mt-auto pt-6 border-t border-gray-200 dark:border-white/5">
              <button
                onClick={onClose}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-gray-400 hover:text-gray-600 dark:hover:text-white transition-all text-sm font-medium"
              >
                <X className="w-5 h-5" />
                返回主页
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-8 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white">
                  {activeTab === 'model' ? '模型配置' : '智能体设定'}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {activeTab === 'model' ? '配置 API 中转站与模型参数' : '定义智能体的角色、身份与核心能力'}
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-3">
                 <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-orange-50 dark:bg-orange-500/10 text-brand-orange text-xs font-bold border border-orange-100 dark:border-orange-500/20">
                    <Sparkles className="w-3 h-3" />
                    AI Powered
                 </div>
              </div>
            </div>

            {/* Scrollable Area */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {activeTab === 'model' ? (
                <div className="space-y-8 max-w-3xl">
                  {/* Plato Config */}
                  <div className={`p-6 rounded-3xl border transition-all ${platoEnabled ? 'bg-white dark:bg-white/5 border-rose-200 dark:border-rose-500/30' : 'bg-gray-50/50 dark:bg-black/20 border-gray-200 dark:border-white/5 opacity-80'}`}>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${platoEnabled ? 'bg-rose-100 text-rose-600' : 'bg-gray-200 text-gray-500'}`}>
                          <Zap className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className={`font-bold ${platoEnabled ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>柏拉图 API 中转站 (推荐)</h4>
                          <p className="text-[10px] text-gray-500">高性能多节点 Gemini 中转服务</p>
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
                          <label className="text-xs font-bold text-gray-500 flex items-center gap-2"><Globe className="w-3 h-3" /> API 节点地址</label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {['https://api.bltcy.ai', 'https://api.gptbest.vip', 'https://hk-api.gptbest.vip'].map(url => (
                              <button
                                key={url}
                                onClick={() => setPlatoBaseUrl(url)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${platoBaseUrl === url ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500'}`}
                              >
                                {url.includes('bltcy') ? '主站节点' : url.includes('hk') ? '香港节点' : '美国节点'}
                              </button>
                            ))}
                          </div>
                          <input
                            type="text"
                            value={platoBaseUrl}
                            onChange={(e) => setPlatoBaseUrl(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-rose-500/20 outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-500 flex items-center gap-2"><Key className="w-3 h-3" /> API Key</label>
                          <div className="relative">
                            <input
                              type={isPlatoKeyVisible ? 'text' : 'password'}
                              value={platoApiKey}
                              onChange={(e) => setPlatoApiKey(e.target.value)}
                              placeholder="sk-..."
                              className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-rose-500/20 outline-none"
                            />
                            <button onClick={() => setIsPlatoKeyVisible(!isPlatoKeyVisible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                              {isPlatoKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-4 mt-2">
                           <div className="flex-1">
                             {platoTestStatus !== 'idle' && (
                               <span className={`text-[10px] font-bold ${platoTestStatus === 'success' ? 'text-green-500' : platoTestStatus === 'testing' ? 'text-blue-500' : 'text-red-500'}`}>
                                 {platoTestMessage}
                               </span>
                             )}
                           </div>
                           <button
                             onClick={handleTestPlato}
                             disabled={platoTestStatus === 'testing'}
                             className="px-4 py-1.5 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-gray-500 hover:text-rose-600 text-xs font-bold transition-all border border-gray-200 dark:border-white/10"
                           >
                             {platoTestStatus === 'testing' ? <RefreshCw className="w-3 h-3 animate-spin" /> : '测试连接'}
                           </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Native Gemini Config */}
                  <div className={`p-6 rounded-3xl border transition-all ${nativeEnabled ? 'bg-white dark:bg-white/5 border-blue-200 dark:border-blue-500/30' : 'bg-gray-50/50 dark:bg-black/20 border-gray-200 dark:border-white/5 opacity-80'}`}>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${nativeEnabled ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500'}`}>
                          <Cpu className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className={`font-bold ${nativeEnabled ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>Google Gemini 原生 API</h4>
                          <p className="text-[10px] text-gray-500">直接使用 Google 官方 API 接口</p>
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
                          <label className="text-xs font-bold text-gray-500 flex items-center gap-2"><Key className="w-3 h-3" /> API Key</label>
                          <div className="relative">
                            <input
                              type={isNativeKeyVisible ? 'text' : 'password'}
                              value={nativeApiKey}
                              onChange={(e) => setNativeApiKey(e.target.value)}
                              placeholder="AIzaSy..."
                              className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                            />
                            <button onClick={() => setIsNativeKeyVisible(!isNativeKeyVisible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                              {isNativeKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-4 mt-2">
                           <div className="flex-1">
                             {nativeTestStatus !== 'idle' && (
                               <span className={`text-[10px] font-bold ${nativeTestStatus === 'success' ? 'text-green-500' : nativeTestStatus === 'testing' ? 'text-blue-500' : 'text-red-500'}`}>
                                 {nativeTestMessage}
                               </span>
                             )}
                           </div>
                           <button
                             onClick={handleTestNative}
                             disabled={nativeTestStatus === 'testing'}
                             className="px-4 py-1.5 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-blue-50 dark:hover:bg-blue-500/10 text-gray-500 hover:text-blue-600 text-xs font-bold transition-all border border-gray-200 dark:border-white/10"
                           >
                             {nativeTestStatus === 'testing' ? <RefreshCw className="w-3 h-3 animate-spin" /> : '测试连接'}
                           </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Yunwu Config */}
                  <div className={`p-6 rounded-3xl border transition-all ${yunwuEnabled ? 'bg-white dark:bg-white/5 border-brand-orange/30' : 'bg-gray-50/50 dark:bg-black/20 border-gray-200 dark:border-white/5 opacity-80'}`}>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${yunwuEnabled ? 'bg-orange-100 text-brand-orange' : 'bg-gray-200 text-gray-500'}`}>
                          <Cloud className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className={`font-bold ${yunwuEnabled ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>云雾 API 中转站</h4>
                          <p className="text-[10px] text-gray-500">标准兼容型 Gemini 中转服务</p>
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
                          <label className="text-xs font-bold text-gray-500">API Base URL</label>
                          <input
                            type="text"
                            value={yunwuBaseUrl}
                            onChange={(e) => setYunwuBaseUrl(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500/20 outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-500">API Key</label>
                          <div className="relative">
                            <input
                              type={isYunwuKeyVisible ? 'text' : 'password'}
                              value={yunwuApiKey}
                              onChange={(e) => setYunwuApiKey(e.target.value)}
                              className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500/20 outline-none"
                            />
                            <button onClick={() => setIsYunwuKeyVisible(!isYunwuKeyVisible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                              {isYunwuKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-500">默认模型</label>
                          <select
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500/20 outline-none"
                          >
                            {AVAILABLE_MODELS.map(m => (
                              <option key={m.id} value={m.id}>{m.name} - {m.description}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center justify-between gap-4 mt-2">
                           <div className="flex-1">
                             {yunwuTestStatus !== 'idle' && (
                               <span className={`text-[10px] font-bold ${yunwuTestStatus === 'success' ? 'text-green-500' : yunwuTestStatus === 'testing' ? 'text-blue-500' : 'text-red-500'}`}>
                                 {yunwuTestMessage}
                               </span>
                             )}
                           </div>
                           <button
                             onClick={handleTestYunwu}
                             disabled={yunwuTestStatus === 'testing'}
                             className="px-4 py-1.5 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-orange-50 dark:hover:bg-orange-500/10 text-gray-500 hover:text-orange-600 text-xs font-bold transition-all border border-gray-200 dark:border-white/10"
                           >
                             {yunwuTestStatus === 'testing' ? <RefreshCw className="w-3 h-3 animate-spin" /> : '测试连接'}
                           </button>
                        </div>
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
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
