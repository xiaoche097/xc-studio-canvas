import React, { useState, useEffect, useCallback } from 'react';
import {
    Cloud,
    Key,
    Globe,
    Save,
    Check,
    AlertTriangle,
    Eye,
    EyeOff,
    RefreshCw,
    Zap,
    Shield,
    ArrowLeft,
    Send,
    Image as ImageIcon,
    MessageCircle,
    Sparkles,
    Copy,
    CheckCircle2,
    X,
    Upload,
    Trash2,
    Settings
} from 'lucide-react';
import { resolveRuntimeModelId } from '../Cyzx4/utils/apiHelpers';

// ==================== 配置常量 ====================
const DEFAULT_BASE_URL = 'https://yunwu.ai';
const DEFAULT_MODEL = 'gemini-3-pro-preview';

// 可用模型列表 - 只保留常用的三个模型
const AVAILABLE_MODELS = [
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', description: '最新最强的Pro模型', badge: '推荐', type: 'text' },
    { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite', description: '快速响应模型', badge: '快速', type: 'text' },
    { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image', description: '图片生成模型', badge: '图像', type: 'image' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: '提示词润色同款模型', badge: '稳定', type: 'text' },
];

// ==================== 类型定义 ====================
interface Message {
    id: string;
    role: 'user' | 'model';
    content: string;
    images?: string[];
    timestamp: number;
}

interface ApiConfig {
    baseUrl: string;
    apiKey: string;
    defaultModel: string;
    isPlato?: boolean;
}

// ==================== API 客户端 ====================
class YunwuApiClient {
    private config: ApiConfig;

    constructor(config: ApiConfig) {
        this.config = config;
    }

    private buildUrl(model: string): string {
        const runtimeModel = resolveRuntimeModelId(model, { isYunwu: true, isPlato: this.config.isPlato === true });
        return `${this.config.baseUrl}/v1beta/models/${runtimeModel}:generateContent?key=${this.config.apiKey}`;
    }

    async generateContent(
        prompt: string,
        model: string,
        images: { base64: string; mimeType: string }[] = [],
        options: { temperature?: number; maxOutputTokens?: number } = {}
    ): Promise<{ text: string; images?: string[] }> {
        const url = this.buildUrl(model);

        // 构建 parts
        const parts: any[] = [];

        // 添加图片
        images.forEach(img => {
            parts.push({
                inlineData: {
                    mimeType: img.mimeType,
                    data: img.base64
                }
            });
        });

        // 添加文本
        parts.push({ text: prompt });

        const requestBody: any = {
            contents: [
                {
                    role: 'user',
                    parts
                }
            ],
            generationConfig: {
                temperature: options.temperature ?? 1,
                maxOutputTokens: options.maxOutputTokens ?? 8192
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': this.config.apiKey,
                'Authorization': `Bearer ${this.config.apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `HTTP Error ${response.status}`);
        }

        const data = await response.json();

        // 提取结果
        const result: { text: string; images?: string[] } = { text: '' };
        const responseParts = data.candidates?.[0]?.content?.parts || [];

        for (const part of responseParts) {
            if (part.text) {
                result.text += part.text;
            }
            if (part.inlineData) {
                if (!result.images) result.images = [];
                result.images.push(`data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`);
            }
        }

        return result;
    }

    async testConnection(model: string): Promise<boolean> {
        try {
            const result = await this.generateContent(
                'Say "OK" to confirm connection.',
                model,
                [],
                { temperature: 0.1, maxOutputTokens: 10 }
            );
            return result.text.length > 0;
        } catch {
            return false;
        }
    }
}

// ==================== 工具函数 ====================
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
interface YunwuApiStudioProps {
    onBack?: () => void;
}

const YunwuApiStudio: React.FC<YunwuApiStudioProps> = ({ onBack }) => {
    // 配置状态
    const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
    const [apiKey, setApiKey] = useState('');
    const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
    const [isPlatoConfig, setIsPlatoConfig] = useState(false);
    const [isKeyVisible, setIsKeyVisible] = useState(false);

    // 配置保存状态
    const [configStatus, setConfigStatus] = useState<'idle' | 'saved' | 'empty'>('idle');
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [testMessage, setTestMessage] = useState('');

    // 聊天状态
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [uploadedImages, setUploadedImages] = useState<{ base64: string; mimeType: string; preview: string }[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [currentTab, setCurrentTab] = useState<'config' | 'chat'>('chat');

    // 复制状态
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // 加载保存的配置
    useEffect(() => {
        const savedKey = localStorage.getItem('yunwu_api_key');
        const savedUrl = localStorage.getItem('yunwu_base_url');
        const savedModel = localStorage.getItem('yunwu_default_model');

        // Plato 优先加载逻辑
        const platoEnabled = localStorage.getItem('plato_enabled') === 'true';
        const platoKey = localStorage.getItem('plato_api_key');
        const platoUrl = localStorage.getItem('plato_base_url');

        if (platoEnabled && platoKey && platoUrl) {
            setBaseUrl(platoUrl);
            setApiKey(platoKey);
            setIsPlatoConfig(true);
            setConfigStatus('saved');
        } else {
            if (savedUrl) setBaseUrl(savedUrl);
            if (savedKey) setApiKey(savedKey);
            setIsPlatoConfig(false);
            if (savedKey && savedUrl) {
                setConfigStatus('saved');
            } else if (savedKey) {
                setConfigStatus('saved');
            } else {
                setConfigStatus('empty');
            }
        }

        if (savedModel) setSelectedModel(savedModel);
    }, []);

    // 保存配置
    const handleSaveConfig = () => {
        if (!apiKey.trim()) {
            setConfigStatus('empty');
            return;
        }

        localStorage.setItem('yunwu_api_key', apiKey.trim());
        localStorage.setItem('yunwu_base_url', baseUrl.trim() || DEFAULT_BASE_URL);
        localStorage.setItem('yunwu_default_model', selectedModel);
        setIsPlatoConfig(false);

        setConfigStatus('saved');
    };

    // 测试连接
    const handleTestConnection = async () => {
        if (!apiKey.trim()) {
            setTestStatus('error');
            setTestMessage('请先输入 API Key');
            return;
        }

        setTestStatus('testing');
        setTestMessage('正在测试连接...');

        try {
            // 优化：测试时直接使用输入框中的第一个 Key 和 URL，
            // 模型固定为 gemini-3.1-flash-lite-preview (最便宜/快速)
            const testModel = 'gemini-3.1-flash-lite-preview';
            const firstKey = apiKey.split(/[,\n]/).map(k => k.trim()).filter(k => k !== "")[0];

            if (!firstKey) {
                throw new Error('请输入有效的 API Key');
            }

            const client = new YunwuApiClient({
                baseUrl: baseUrl.trim() || DEFAULT_BASE_URL,
                apiKey: firstKey,
                defaultModel: testModel,
                isPlato: isPlatoConfig
            });

            const success = await client.testConnection(testModel);

            if (success) {
                setTestStatus('success');
                setTestMessage('✅ 连接成功!');
            } else {
                setTestStatus('error');
                setTestMessage('❌ 连接失败: 无响应');
            }
        } catch (error) {
            setTestStatus('error');
            setTestMessage(`❌ ${error instanceof Error ? error.message : '未知错误'}`);
        }
    };

    // 处理图片上传
    const handleImageUpload = async (files: FileList | null) => {
        if (!files) return;

        const newImages: { base64: string; mimeType: string; preview: string }[] = [];

        for (let i = 0; i < Math.min(files.length, 5); i++) {
            const file = files[i];
            if (file.type.startsWith('image/')) {
                const { base64, mimeType } = await fileToBase64(file);
                newImages.push({
                    base64,
                    mimeType,
                    preview: URL.createObjectURL(file)
                });
            }
        }

        setUploadedImages(prev => [...prev, ...newImages].slice(0, 5));
    };

    // 移除图片
    const removeImage = (index: number) => {
        setUploadedImages(prev => prev.filter((_, i) => i !== index));
    };

    // 发送消息
    const handleSend = async () => {
        if (!inputText.trim() && uploadedImages.length === 0) return;
        if (!apiKey.trim()) {
            setTestMessage('请先配置 API Key');
            setCurrentTab('config');
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
            const client = new YunwuApiClient({
                baseUrl: baseUrl.trim() || DEFAULT_BASE_URL,
                apiKey: apiKey.trim(),
                defaultModel: selectedModel,
                isPlato: isPlatoConfig
            });

            const result = await client.generateContent(
                userMessage.content,
                selectedModel,
                imagesToSend.map(img => ({ base64: img.base64, mimeType: img.mimeType }))
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

    // 清空对话
    const handleClearChat = () => {
        setMessages([]);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-orange-50/30 to-gray-100 dark:from-slate-900 dark:via-gray-900 dark:to-slate-900">
            {/* 头部导航 - 品牌橙色调 */}
            <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-white/10">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="p-2 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white transition-all"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                        )}
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-gradient-to-br from-brand-orange to-orange-500 rounded-xl shadow-lg shadow-orange-500/30">
                                <Cloud className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900 dark:text-white">云雾API Studio</h1>
                                <p className="text-xs text-gray-500 dark:text-white/50">Yunwu API for Gemini</p>
                            </div>
                        </div>
                    </div>

                    {/* Tab 切换 */}
                    <div className="flex bg-gray-100 dark:bg-white/5 rounded-xl p-1">
                        <button
                            onClick={() => setCurrentTab('config')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${currentTab === 'config'
                                ? 'bg-brand-orange text-white shadow-lg'
                                : 'text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            <Shield className="w-4 h-4" />
                            配置
                        </button>
                        <button
                            onClick={() => setCurrentTab('chat')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${currentTab === 'chat'
                                ? 'bg-brand-orange text-white shadow-lg'
                                : 'text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            <MessageCircle className="w-4 h-4" />
                            对话
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto p-4">
                {currentTab === 'config' ? (
                    /* ==================== 配置面板 ==================== */
                    <div className="max-w-2xl mx-auto w-full space-y-8 pb-10">
                        {/* 集中管理提示 */}
                        <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-6 flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                                <Settings className="text-orange-500" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-orange-600 dark:text-orange-400 font-bold text-sm">统一配置管理</h4>
                                <p className="text-xs text-orange-700/70 dark:text-orange-300/70 leading-relaxed">
                                    我们现在支持在首页设置中统一管理所有 API 提供商。您可以直接在那里配置 API Key，配置将自动同步到此工作站。
                                </p>
                            </div>
                        </div>

                        {/* 配置卡片 */}
                        <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl p-8 shadow-xl">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 bg-gradient-to-br from-brand-orange to-orange-500 rounded-xl">
                                    <Key className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">API 配置</h2>
                                    <p className="text-sm text-gray-500 dark:text-white/50">配置云雾API中转站连接</p>
                                </div>
                            </div>

                            <div className="space-y-5">
                                {/* Base URL */}
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-white/80">
                                        <Globe className="w-4 h-4 text-brand-orange" />
                                        API Base URL
                                    </label>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        <button
                                            onClick={() => setBaseUrl('https://yunwu.ai')}
                                            className={`px-3 py-1 text-xs rounded-full border transition-all ${baseUrl === 'https://yunwu.ai' ? 'bg-orange-100 border-orange-300 text-orange-700' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:border-orange-200'}`}
                                        >
                                            主站节点
                                        </button>
                                        <button
                                            onClick={() => setBaseUrl('https://api.apiplus.org')}
                                            className={`px-3 py-1 text-xs rounded-full border transition-all ${baseUrl === 'https://api.apiplus.org' ? 'bg-orange-100 border-orange-300 text-orange-700' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:border-orange-200'}`}
                                        >
                                            CF站节点
                                        </button>
                                        <button
                                            onClick={() => setBaseUrl('https://api3.wlai.vip')}
                                            className={`px-3 py-1 text-xs rounded-full border transition-all ${baseUrl === 'https://api3.wlai.vip' ? 'bg-orange-100 border-orange-300 text-orange-700' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:border-orange-200'}`}
                                        >
                                            国内节点
                                        </button>
                                        <button
                                            onClick={() => setBaseUrl('https://api.zhongzhuan.chat')}
                                            className={`px-3 py-1 text-xs rounded-full border transition-all ${baseUrl === 'https://api.zhongzhuan.chat' ? 'bg-orange-100 border-orange-300 text-orange-700' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:border-orange-200'}`}
                                        >
                                            中转节点
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        value={baseUrl}
                                        onChange={(e) => setBaseUrl(e.target.value)}
                                        placeholder="https://yunwu.ai"
                                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl py-3 px-4 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20 outline-none transition-all font-mono text-sm"
                                    />
                                    <p className="text-xs text-gray-500 dark:text-white/40">
                                        默认: <code className="text-brand-orange">{DEFAULT_BASE_URL}</code>
                                    </p>
                                </div>

                                {/* API Key */}
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-white/80">
                                        <Key className="w-4 h-4 text-brand-orange" />
                                        API Key
                                        <span className="text-red-400 text-xs">*必填</span>
                                    </label>
                                    <div className="relative">
                                        <textarea
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                            rows={4}
                                            style={{ WebkitTextSecurity: isKeyVisible ? 'none' : 'disc' } as React.CSSProperties}
                                            placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                                            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl py-3 pl-4 pr-12 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20 outline-none transition-all font-mono text-sm resize-none"
                                        />
                                        <button
                                            onClick={() => setIsKeyVisible(!isKeyVisible)}
                                            className="absolute right-3 top-3 text-gray-400 dark:text-white/40 hover:text-brand-orange transition-colors"
                                        >
                                            {isKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-gray-500 dark:text-white/40 mt-1">
                                        支持多 Key 轮询，请使用逗号或换行分隔。
                                    </p>
                                </div>
                            </div>

                            {/* 分隔线 */}
                            <div className="my-6 border-t border-gray-200 dark:border-white/10"></div>

                            {/* 状态与操作 */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-2 flex-wrap">
                                    {configStatus === 'saved' && (
                                        <span className="flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 px-3 py-2 rounded-full border border-green-200 dark:border-green-500/20">
                                            <Check className="w-4 h-4" /> 配置已保存
                                        </span>
                                    )}
                                    {configStatus === 'empty' && (
                                        <span className="flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 rounded-full border border-amber-200 dark:border-amber-500/20">
                                            <AlertTriangle className="w-4 h-4" /> 未配置
                                        </span>
                                    )}
                                    {testStatus !== 'idle' && (
                                        <span className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-full border ${testStatus === 'testing' ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20' :
                                            testStatus === 'success' ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20' :
                                                'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20'
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
                                        className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-white font-medium rounded-xl border border-gray-200 dark:border-white/10 transition-all disabled:opacity-50"
                                    >
                                        <RefreshCw className={`w-4 h-4 ${testStatus === 'testing' ? 'animate-spin' : ''}`} />
                                        测试连接
                                    </button>
                                    <button
                                        onClick={handleSaveConfig}
                                        className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-brand-orange to-orange-500 hover:opacity-90 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/30 transition-all"
                                    >
                                        <Save className="w-4 h-4" />
                                        保存配置
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 使用说明 */}
                        <div className="bg-white dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-white/10 p-6">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-brand-orange" />
                                使用说明
                            </h3>
                            <div className="grid gap-4 text-sm text-gray-600 dark:text-white/60">
                                <div className="flex gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 bg-orange-100 dark:bg-brand-orange/20 text-brand-orange rounded-full flex items-center justify-center text-xs font-bold">1</span>
                                    <div>
                                        <strong className="text-gray-900 dark:text-white">获取 API Key</strong>
                                        <p>前往云雾API控制台获取您的专属 API Key</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 bg-orange-100 dark:bg-brand-orange/20 text-brand-orange rounded-full flex items-center justify-center text-xs font-bold">2</span>
                                    <div>
                                        <strong className="text-gray-900 dark:text-white">配置连接</strong>
                                        <p>填写 Base URL 和 API Key，点击「测试连接」验证</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 bg-orange-100 dark:bg-brand-orange/20 text-brand-orange rounded-full flex items-center justify-center text-xs font-bold">3</span>
                                    <div>
                                        <strong className="text-gray-900 dark:text-white">开始使用</strong>
                                        <p>切换到「对话」标签页，开始与 Gemini 模型交互</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* ==================== 聊天面板 ==================== */
                    <div className="flex flex-col h-[calc(100vh-80px)]">
                        {/* 模型选择 & 工具栏 */}
                        <div className="flex items-center justify-between py-3 px-2">
                            <select
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value)}
                                className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl py-2 px-4 text-gray-900 dark:text-white text-sm focus:border-brand-orange outline-none transition-all"
                            >
                                {AVAILABLE_MODELS.map((model) => (
                                    <option key={model.id} value={model.id} className="bg-white dark:bg-slate-800">
                                        {model.name} {model.badge ? `[${model.badge}]` : ''}
                                    </option>
                                ))}
                            </select>

                            <button
                                onClick={handleClearChat}
                                className="flex items-center gap-2 px-4 py-2 text-gray-500 dark:text-white/60 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all text-sm"
                            >
                                <Trash2 className="w-4 h-4" />
                                清空对话
                            </button>
                        </div>

                        {/* 消息区域 */}
                        <div className="flex-1 overflow-y-auto px-2 space-y-4 pb-4">
                            {messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center">
                                    <div className="p-4 bg-orange-100 dark:bg-brand-orange/10 rounded-2xl mb-4">
                                        <MessageCircle className="w-12 h-12 text-brand-orange" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">开始对话</h3>
                                    <p className="text-gray-500 dark:text-white/50 max-w-md">
                                        输入文字或上传图片，与 Gemini 模型进行交互
                                    </p>
                                </div>
                            ) : (
                                messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[85%] ${msg.role === 'user'
                                            ? 'bg-gradient-to-br from-brand-orange to-orange-500 text-white'
                                            : 'bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white'
                                            } rounded-2xl p-4`}>
                                            {/* 图片 */}
                                            {msg.images && msg.images.length > 0 && (
                                                <div className="flex flex-wrap gap-2 mb-3">
                                                    {msg.images.map((img, i) => (
                                                        <img
                                                            key={i}
                                                            src={img}
                                                            alt=""
                                                            className="max-w-[200px] rounded-lg"
                                                        />
                                                    ))}
                                                </div>
                                            )}

                                            {/* 文本 */}
                                            <div className="whitespace-pre-wrap text-sm">{msg.content}</div>

                                            {/* 复制按钮 */}
                                            {msg.role === 'model' && (
                                                <button
                                                    onClick={() => handleCopy(msg.content, msg.id)}
                                                    className="mt-2 flex items-center gap-1 text-xs text-gray-400 dark:text-white/40 hover:text-brand-orange transition-colors"
                                                >
                                                    {copiedId === msg.id ? (
                                                        <>
                                                            <CheckCircle2 className="w-3 h-3" /> 已复制
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy className="w-3 h-3" /> 复制
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}

                            {/* 生成中状态 */}
                            {isGenerating && (
                                <div className="flex justify-start">
                                    <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4 flex items-center gap-3">
                                        <RefreshCw className="w-5 h-5 text-brand-orange animate-spin" />
                                        <span className="text-gray-500 dark:text-white/60 text-sm">正在生成...</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 输入区域 */}
                        <div className="p-4 bg-white/80 dark:bg-black/30 backdrop-blur-xl border-t border-gray-200 dark:border-white/10">
                            {/* 已上传图片预览 */}
                            {uploadedImages.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {uploadedImages.map((img, i) => (
                                        <div key={i} className="relative group">
                                            <img src={img.preview} alt="" className="w-16 h-16 object-cover rounded-lg" />
                                            <button
                                                onClick={() => removeImage(i)}
                                                className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="w-3 h-3 text-white" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-end gap-3">
                                {/* 图片上传 */}
                                <label className="flex-shrink-0 p-3 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl cursor-pointer transition-all border border-gray-200 dark:border-white/10">
                                    <ImageIcon className="w-5 h-5 text-gray-500 dark:text-white/60" />
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={(e) => handleImageUpload(e.target.files)}
                                        className="hidden"
                                    />
                                </label>

                                {/* 文本输入 */}
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
                                    className="flex-1 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl py-3 px-4 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 focus:border-brand-orange outline-none resize-none min-h-[48px] max-h-[200px]"
                                />

                                {/* 发送按钮 */}
                                <button
                                    onClick={handleSend}
                                    disabled={isGenerating || (!inputText.trim() && uploadedImages.length === 0)}
                                    className="flex-shrink-0 p-3 bg-gradient-to-r from-brand-orange to-orange-500 hover:opacity-90 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/30"
                                >
                                    <Send className="w-5 h-5 text-white" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default YunwuApiStudio;
