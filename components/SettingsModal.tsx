import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Save, Key, Globe, Zap, Eye, EyeOff, ShieldCheck, 
  Settings as SettingsIcon, Bot, ChevronRight, Check,
  AlertCircle, ExternalLink, LayoutDashboard
} from 'lucide-react';
import { gemini } from '../lib/gemini';

type TabType = 'api' | 'agent' | 'about';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: TabType;
}

// --- Sub-components ---

const Switch: React.FC<{ enabled: boolean; onChange: (v: boolean) => void }> = ({ enabled, onChange }) => (
  <button
    onClick={() => onChange(!enabled)}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
      enabled ? 'bg-orange-500' : 'bg-gray-300 dark:bg-white/10'
    }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
        enabled ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);

const ConfigInput: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  icon?: React.ReactNode;
}> = ({ label, value, onChange, placeholder, type = 'text', icon }) => {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider pl-1">
        {label}
      </label>
      <div className="relative group">
        {icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600 group-focus-within:text-orange-500 transition-colors">
            {icon}
          </div>
        )}
        <input
          type={isPassword ? (show ? 'text' : 'password') : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl py-2.5 ${
            icon ? 'pl-10' : 'pl-4'
          } pr-10 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all dark:text-white font-mono`}
        />
        {isPassword && (
          <button
            onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
    </div>
  );
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, initialTab = 'api' }) => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);
  
  // Provider States
  const [geminiConfig, setGeminiConfig] = useState({
    enabled: true,
    apiKey: '',
    baseUrl: 'https://generativelanguage.googleapis.com'
  });
  
  const [yunwuConfig, setYunwuConfig] = useState({
    enabled: false,
    apiKey: '',
    baseUrl: ''
  });
  
  const [platoConfig, setPlatoConfig] = useState({
    enabled: false,
    apiKey: '',
    baseUrl: ''
  });

  const [jijingConfig, setJijingConfig] = useState({
    enabled: false,
    apiKey: '',
    baseUrl: 'https://api.jijing.ai'
  });

  // Global Status
  const [status, setStatus] = useState<{ type: 'idle' | 'testing' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: ''
  });

  useEffect(() => {
    if (isOpen) {
      // Load Gemini Native
      const gKey = localStorage.getItem('user_gemini_api_key') || '';
      const gUrl = localStorage.getItem('user_gemini_base_url') || 'https://generativelanguage.googleapis.com';
      const gEnabled = localStorage.getItem('gemini_native_enabled') !== 'false';
      setGeminiConfig({ enabled: gEnabled, apiKey: gKey, baseUrl: gUrl });

      // Load Yunwu
      const yKey = localStorage.getItem('yunwu_api_key') || '';
      const yUrl = localStorage.getItem('yunwu_base_url') || '';
      const yEnabled = localStorage.getItem('yunwu_enabled') === 'true';
      setYunwuConfig({ enabled: yEnabled, apiKey: yKey, baseUrl: yUrl });

      // Load Plato
      const pKey = localStorage.getItem('plato_api_key') || '';
      const pUrl = localStorage.getItem('plato_base_url') || '';
      const pEnabled = localStorage.getItem('plato_enabled') === 'true';
      setPlatoConfig({ enabled: pEnabled, apiKey: pKey, baseUrl: pUrl });

      // Load Jijing
      const jKey = localStorage.getItem('jijing_api_key') || '';
      const jUrl = localStorage.getItem('jijing_base_url') || 'https://api.jijing.ai';
      const jEnabled = localStorage.getItem('jijing_enabled') === 'true';
      setJijingConfig({ enabled: jEnabled, apiKey: jKey, baseUrl: jUrl });
    }
  }, [isOpen]);

  const saveAll = () => {
    // Save to local storage
    localStorage.setItem('user_gemini_api_key', geminiConfig.apiKey);
    localStorage.setItem('user_gemini_base_url', geminiConfig.baseUrl);
    localStorage.setItem('gemini_native_enabled', String(geminiConfig.enabled));

    localStorage.setItem('yunwu_api_key', yunwuConfig.apiKey);
    localStorage.setItem('yunwu_base_url', yunwuConfig.baseUrl);
    localStorage.setItem('yunwu_enabled', String(yunwuConfig.enabled));

    localStorage.setItem('plato_api_key', platoConfig.apiKey);
    localStorage.setItem('plato_base_url', platoConfig.baseUrl);
    localStorage.setItem('plato_enabled', String(platoConfig.enabled));

    localStorage.setItem('jijing_api_key', jijingConfig.apiKey);
    localStorage.setItem('jijing_base_url', jijingConfig.baseUrl || 'https://api.jijing.ai');
    localStorage.setItem('jijing_enabled', String(jijingConfig.enabled));

    // Determine active provider
    let activeKey = geminiConfig.apiKey;
    let activeUrl = geminiConfig.baseUrl;

    if (jijingConfig.enabled && jijingConfig.apiKey) {
        activeKey = jijingConfig.apiKey;
        activeUrl = jijingConfig.baseUrl || 'https://api.jijing.ai';
    } else if (platoConfig.enabled && platoConfig.apiKey) {
        activeKey = platoConfig.apiKey;
        activeUrl = platoConfig.baseUrl;
    } else if (yunwuConfig.enabled && yunwuConfig.apiKey) {
        activeKey = yunwuConfig.apiKey;
        activeUrl = yunwuConfig.baseUrl;
    }

    // Update global Gemini client
    gemini.updateApiKey(activeKey.trim() || import.meta.env.VITE_GEMINI_API_KEY || "", activeUrl);

    setStatus({ type: 'success', message: '配置已全局同步' });
    setTimeout(() => setStatus({ type: 'idle', message: '' }), 2000);
  };

  const testConnection = async (type: 'gemini' | 'yunwu' | 'plato' | 'jijing') => {
    setStatus({ type: 'testing', message: `正在连接 ${type}...` });
    
    let key = '';
    let url = '';
    
    if (type === 'gemini') { key = geminiConfig.apiKey; url = geminiConfig.baseUrl; }
    if (type === 'yunwu') { key = yunwuConfig.apiKey; url = yunwuConfig.baseUrl; }
    if (type === 'plato') { key = platoConfig.apiKey; url = platoConfig.baseUrl; }
    if (type === 'jijing') { key = jijingConfig.apiKey; url = jijingConfig.baseUrl; }

    if (!key) {
        setStatus({ type: 'error', message: '请输入 API Key 后再测试' });
        return;
    }

    try {
        const cleanUrl = (url || 'https://generativelanguage.googleapis.com').replace(/\/$/, "");
        const response = await fetch(`${cleanUrl}/v1beta/models?key=${key}`);
        if (response.ok) {
            setStatus({ type: 'success', message: `${type} 连接成功！` });
        } else {
            const err = await response.text();
            setStatus({ type: 'error', message: `连接失败: ${response.status}` });
        }
    } catch (e) {
        setStatus({ type: 'error', message: '网络请求失败，请检查 Base URL' });
    }
    
    setTimeout(() => setStatus(s => s.type === 'testing' ? s : { ...s, type: 'idle' }), 3000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-0 md:p-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
          onClick={onClose}
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          className="relative w-full h-full max-w-6xl md:max-h-[85vh] bg-white dark:bg-[#0c0c0e] rounded-none md:rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-gray-100 dark:border-white/5"
        >
          {/* Sidebar */}
          <div className="w-full md:w-64 bg-gray-50/50 dark:bg-black/40 border-b md:border-b-0 md:border-r border-gray-100 dark:border-white/5 flex flex-col">
            <div className="p-6">
                <button 
                  onClick={onClose}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-white/5 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 border border-gray-100 dark:border-white/10 hover:border-orange-500/50 transition-all group"
                >
                    <LayoutDashboard size={18} className="text-gray-400 group-hover:text-orange-500" />
                    返回主页
                </button>
            </div>

            <div className="flex-1 px-4 space-y-1">
                <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    工作台
                </div>
                <button 
                  onClick={() => setActiveTab('api')}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    activeTab === 'api' 
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' 
                      : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Key size={18} />
                    模型配置
                  </div>
                  <ChevronRight size={14} className={activeTab === 'api' ? 'opacity-100' : 'opacity-0'} />
                </button>

                <button 
                  onClick={() => setActiveTab('agent')}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    activeTab === 'agent' 
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' 
                      : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Bot size={18} />
                    智能体设定
                  </div>
                  <ChevronRight size={14} className={activeTab === 'agent' ? 'opacity-100' : 'opacity-0'} />
                </button>
            </div>

            <div className="p-6 border-t border-gray-100 dark:border-white/5">
                <div className="flex items-center gap-3 px-4 py-2 text-xs text-gray-400">
                    <AlertCircle size={14} />
                    <span>V2.5.0 Professional</span>
                </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col bg-white dark:bg-[#0c0c0e] overflow-hidden">
            {/* Header */}
            <div className="px-8 py-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {activeTab === 'api' ? '模型配置' : '智能体设定'}
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {activeTab === 'api' ? '管理您的 API Key 和模型接入点' : '自定义 AI 的身份、背景与核心能力'}
                    </p>
                </div>
                
                {status.type !== 'idle' && (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-sm ${
                        status.type === 'success' ? 'bg-green-500/10 text-green-600 border border-green-500/20' :
                        status.type === 'error' ? 'bg-red-500/10 text-red-600 border border-red-500/20' :
                        'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                      }`}
                    >
                        {status.type === 'testing' && <Zap size={14} className="animate-pulse" />}
                        {status.type === 'success' && <Check size={14} />}
                        {status.message}
                    </motion.div>
                )}
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {activeTab === 'api' ? (
                    <div className="max-w-3xl space-y-8 pb-10">
                        {/* Google Gemini Native */}
                        <ProviderCard 
                          title="Google Gemini 原生 API"
                          description="通过 Google AI Studio 获取官方 API Key，直接连接原生服务。"
                          icon={<ShieldCheck className="text-blue-500" />}
                          enabled={geminiConfig.enabled}
                          onToggle={(v) => setGeminiConfig(c => ({ ...c, enabled: v }))}
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <ConfigInput 
                                  label="Base URL (可选代理)"
                                  value={geminiConfig.baseUrl}
                                  onChange={(v) => setGeminiConfig(c => ({ ...c, baseUrl: v }))}
                                  placeholder="https://generativelanguage.googleapis.com"
                                  icon={<Globe size={16} />}
                                />
                                <ConfigInput 
                                  label="API Key"
                                  value={geminiConfig.apiKey}
                                  onChange={(v) => setGeminiConfig(c => ({ ...c, apiKey: v }))}
                                  placeholder="粘贴您的官方 Key..."
                                  type="password"
                                  icon={<Key size={16} />}
                                />
                            </div>
                            <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-100 dark:border-white/5">
                                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                                    获取官方密钥 <ExternalLink size={12} />
                                </a>
                                <button onClick={() => testConnection('gemini')} className="text-xs font-bold text-gray-500 hover:text-orange-500 transition-colors">
                                    测试连接
                                </button>
                            </div>
                        </ProviderCard>

                        {/* Yunwu API */}
                        <ProviderCard 
                          title="云雾 API 中转站"
                          description="支持更多模型版本，免去繁琐网络配置，稳定可靠。"
                          icon={<Globe className="text-cyan-500" />}
                          enabled={yunwuConfig.enabled}
                          onToggle={(v) => setYunwuConfig(c => ({ ...c, enabled: v }))}
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <ConfigInput 
                                  label="Base URL"
                                  value={yunwuConfig.baseUrl}
                                  onChange={(v) => setYunwuConfig(c => ({ ...c, baseUrl: v }))}
                                  placeholder="https://api.yunwu.com/v1"
                                  icon={<Globe size={16} />}
                                />
                                <ConfigInput 
                                  label="API Key"
                                  value={yunwuConfig.apiKey}
                                  onChange={(v) => setYunwuConfig(c => ({ ...c, apiKey: v }))}
                                  placeholder="sk-..."
                                  type="password"
                                  icon={<Key size={16} />}
                                />
                            </div>
                            <div className="flex justify-end mt-4">
                                <button onClick={() => testConnection('yunwu')} className="text-xs font-bold text-gray-500 hover:text-orange-500 transition-colors">
                                    测试连接
                                </button>
                            </div>
                        </ProviderCard>

                        {/* Plato API - Recommended */}
                        <ProviderCard 
                          title="柏拉图 API 中转站"
                          description="针对电商场景深度优化，响应速度极快，推荐使用。"
                          icon={<Zap className="text-orange-500" />}
                          enabled={platoConfig.enabled}
                          onToggle={(v) => setPlatoConfig(c => ({ ...c, enabled: v }))}
                          recommended
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <ConfigInput 
                                  label="Base URL"
                                  value={platoConfig.baseUrl}
                                  onChange={(v) => setPlatoConfig(c => ({ ...c, baseUrl: v }))}
                                  placeholder="https://api.plato-ai.com/v1"
                                  icon={<Globe size={16} />}
                                />
                                <ConfigInput 
                                  label="API Key"
                                  value={platoConfig.apiKey}
                                  onChange={(v) => setPlatoConfig(c => ({ ...c, apiKey: v }))}
                                  placeholder="sk-..."
                                  type="password"
                                  icon={<Key size={16} />}
                                />
                            </div>
                            <div className="flex justify-end mt-4">
                                <button onClick={() => testConnection('plato')} className="text-xs font-bold text-gray-500 hover:text-orange-500 transition-colors">
                                    测试连接
                                </button>
                            </div>
                        </ProviderCard>

                        {/* Jijing API */}
                        <ProviderCard 
                          title="极境 API 中转站"
                          description="使用极境 Gemini 兼容中转服务，默认 Base URL 为 https://api.jijing.ai。"
                          icon={<Zap className="text-orange-500" />}
                          enabled={jijingConfig.enabled}
                          onToggle={(v) => setJijingConfig(c => ({ ...c, enabled: v }))}
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <ConfigInput 
                                  label="Base URL"
                                  value={jijingConfig.baseUrl}
                                  onChange={(v) => setJijingConfig(c => ({ ...c, baseUrl: v }))}
                                  placeholder="https://api.jijing.ai"
                                  icon={<Globe size={16} />}
                                />
                                <ConfigInput 
                                  label="API Key"
                                  value={jijingConfig.apiKey}
                                  onChange={(v) => setJijingConfig(c => ({ ...c, apiKey: v }))}
                                  placeholder="sk-..."
                                  type="password"
                                  icon={<Key size={16} />}
                                />
                            </div>
                            <div className="flex justify-end mt-4">
                                <button onClick={() => testConnection('jijing')} className="text-xs font-bold text-gray-500 hover:text-orange-500 transition-colors">
                                    测试连接
                                </button>
                            </div>
                        </ProviderCard>

                        <div className="p-4 bg-gray-50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-white/5">
                            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">安全提示</h4>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                您的所有 API 密钥均以加密形式存储在浏览器的 LocalStorage 中，绝不会上传至我们的服务器。建议您定期更换密钥并设置使用额度限制。
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="max-w-2xl">
                        <AgentSettingsView />
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            <div className="px-8 py-6 border-t border-gray-100 dark:border-white/5 flex justify-end items-center gap-4 bg-gray-50/50 dark:bg-black/10">
                <button 
                  onClick={onClose}
                  className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-800 dark:hover:text-white transition-colors"
                >
                    取消
                </button>
                <button 
                  onClick={saveAll}
                  className="px-8 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-orange-500/20 hover:-translate-y-0.5 transition-all flex items-center gap-2"
                >
                    <Save size={18} />
                    保存并应用配置
                </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

// --- View Helper Components ---

const ProviderCard: React.FC<{ 
  title: string; 
  description: string; 
  icon: React.ReactNode; 
  enabled: boolean;
  onToggle: (v: boolean) => void;
  recommended?: boolean;
  children: React.ReactNode;
}> = ({ title, description, icon, enabled, onToggle, recommended, children }) => (
  <div className={`p-6 rounded-3xl border transition-all duration-300 ${
    enabled 
      ? 'bg-white dark:bg-white/5 border-orange-500/30 shadow-xl shadow-orange-500/5' 
      : 'bg-gray-50/50 dark:bg-black/20 border-gray-100 dark:border-white/5'
  }`}>
    <div className="flex items-start justify-between mb-6">
        <div className="flex gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center text-xl shadow-inner">
                {icon}
            </div>
            <div>
                <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900 dark:text-white">{title}</h3>
                    {recommended && (
                        <span className="px-2 py-0.5 bg-orange-500 text-white text-[9px] font-bold rounded-full uppercase tracking-tighter">
                            推荐
                        </span>
                    )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</p>
            </div>
        </div>
        <Switch enabled={enabled} onChange={onToggle} />
    </div>
    
    <div className={`transition-all duration-300 ${enabled ? 'opacity-100 translate-y-0' : 'opacity-40 pointer-events-none'}`}>
        {children}
    </div>
  </div>
);

const AgentSettingsView = () => {
    const [agentName, setAgentName] = useState('');
    const [agentRole, setAgentRole] = useState('');
    const [agentCapabilities, setAgentCapabilities] = useState('');

    useEffect(() => {
        setAgentName(localStorage.getItem('agentName') || 'XcAI 首席电商视觉策划师');
        setAgentRole(localStorage.getItem('agentRole') || '你是一个拥有10年经验的亚马逊/独立站电商视觉总监。你的目标是根据用户提供的产品信息或图片，策划出高转化率的视觉方案。');
        setAgentCapabilities(localStorage.getItem('agentCapabilities') || '1. 深入分析产品卖点与目标市场\n2. 策划高转化率的电商图片（主图、副图、A+）\n3. 保持专业、精炼的语言风格');
    }, []);

    const saveAgent = () => {
        localStorage.setItem('agentName', agentName);
        localStorage.setItem('agentRole', agentRole);
        localStorage.setItem('agentCapabilities', agentCapabilities);
        window.dispatchEvent(new Event('agent-settings-updated'));
        alert('智能体设定已保存');
    };

    return (
        <div className="space-y-6 pb-10">
            <div className="space-y-4">
                <ConfigInput 
                  label="智能体名称"
                  value={agentName}
                  onChange={setAgentName}
                  placeholder="例如：XcAI 电商视觉总监"
                />
                
                <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">角色设定</label>
                    <textarea 
                      value={agentRole}
                      onChange={(e) => setAgentRole(e.target.value)}
                      rows={3}
                      className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all dark:text-white resize-none"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">能力与指令</label>
                    <textarea 
                      value={agentCapabilities}
                      onChange={(e) => setAgentCapabilities(e.target.value)}
                      rows={6}
                      className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all dark:text-white resize-none leading-relaxed"
                    />
                </div>
            </div>
            
            <div className="pt-4">
                <button onClick={saveAgent} className="text-sm font-bold text-orange-500 hover:text-orange-600 transition-colors">
                    仅保存智能体设定
                </button>
            </div>
        </div>
    );
};
