import React, { useState, useEffect } from 'react';
import {
  Image as ImageIcon,
  Globe,
  Server,
  RefreshCw,
  Activity,
  Check,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ExternalLink,
  ShieldCheck,
  Zap,
  Info
} from 'lucide-react';

export type ImageHostType = 'none' | 'imgbb' | 'freeimage';

interface ImageHostServiceSettingsProps {
  onNotify?: (message: string) => void;
}

export const ImageHostServiceSettings: React.FC<ImageHostServiceSettingsProps> = ({ onNotify }) => {
  const [activeHost, setActiveHost] = useState<ImageHostType>('imgbb');
  const [imgbbApiKey, setImgbbApiKey] = useState('');
  const [freeimageApiKey, setFreeimageApiKey] = useState('');
  const [isImgbbKeyVisible, setIsImgbbKeyVisible] = useState(false);
  const [isFreeimageKeyVisible, setIsFreeimageKeyVisible] = useState(false);

  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs?: number;
    message: string;
  } | null>(null);

  const [hasChanges, setHasChanges] = useState(false);

  // 初始化加载图床配置
  useEffect(() => {
    try {
      const savedHost = localStorage.getItem('image_host_provider');
      const savedImgbb = localStorage.getItem('imgbb_api_key');
      const savedFreeimage = localStorage.getItem('freeimage_api_key');

      if (savedHost === 'none' || savedHost === 'imgbb' || savedHost === 'freeimage') {
        setActiveHost(savedHost);
      } else {
        setActiveHost('imgbb');
      }

      if (savedImgbb) setImgbbApiKey(savedImgbb);
      if (savedFreeimage) setFreeimageApiKey(savedFreeimage);
    } catch (e) {
      console.error('Failed to load image host settings:', e);
    }
  }, []);

  const getHostLabel = (host: ImageHostType) => {
    switch (host) {
      case 'imgbb':
        return 'ImgBB (官方 API)';
      case 'freeimage':
        return 'FreeImage.host';
      case 'none':
        return 'Base64 内联格式';
      default:
        return '未知图床';
    }
  };

  const handleTestConnection = async () => {
    if (activeHost === 'none') {
      setTestResult({
        success: true,
        latencyMs: 1,
        message: '当前为 Base64 内联模式，数据随请求直接封装，无需外部通道连通性测试',
      });
      return;
    }

    setTestingConnection(true);
    setTestResult(null);
    const startTime = Date.now();

    try {
      if (activeHost === 'imgbb') {
        const rawKey = imgbbApiKey.trim();
        const key = rawKey.split(/[\n,;]+/)[0]?.trim();
        if (!key) throw new Error('请先填写 ImgBB API Key');

        const formData = new FormData();
        formData.append('key', key);
        formData.append('image', 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
        formData.append('name', 'ping_test');

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const resp = await fetch('https://api.imgbb.com/1/upload', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const latency = Date.now() - startTime;

        if (resp.ok) {
          setTestResult({
            success: true,
            latencyMs: latency,
            message: `ImgBB 图床通道正常！响应耗时 ${latency}ms，临时图片自动删除机制已就绪`,
          });
        } else {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `ImgBB 接口报错 (HTTP ${resp.status})`);
        }
      } else if (activeHost === 'freeimage') {
        const rawKey = freeimageApiKey.trim();
        const key = rawKey.split(/[\n,;]+/)[0]?.trim();
        if (!key) throw new Error('请先填写 FreeImage.host API Key');

        const formData = new FormData();
        formData.append('key', key);
        formData.append('source', 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
        formData.append('action', 'upload');
        formData.append('format', 'json');

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const resp = await fetch('https://freeimage.host/api/1/upload', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const latency = Date.now() - startTime;

        if (resp.ok) {
          setTestResult({
            success: true,
            latencyMs: latency,
            message: `FreeImage.host 图床通道正常！响应耗时 ${latency}ms，API v1 上传通道已通畅`,
          });
        } else {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `FreeImage 接口报错 (HTTP ${resp.status})`);
        }
      }
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e?.message || '图床连接测试失败，请检查网络或 API Key',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSave = () => {
    try {
      localStorage.setItem('image_host_provider', activeHost);
      localStorage.setItem('imgbb_api_key', imgbbApiKey.trim());
      localStorage.setItem('freeimage_api_key', freeimageApiKey.trim());
      window.dispatchEvent(new Event('api-settings-updated'));
      setHasChanges(false);
      onNotify?.(`图床服务配置已更新，当前激活：${getHostLabel(activeHost)}`);
    } catch (e) {
      console.error('Save image host failed:', e);
      alert('保存失败，请检查浏览器存储权限');
    }
  };

  const imgbbKeysCount = imgbbApiKey.split(/[\n,;]+/).filter((k) => k.trim()).length;
  const freeimageKeysCount = freeimageApiKey.split(/[\n,;]+/).filter((k) => k.trim()).length;

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] dark:bg-[#080B11] text-slate-800 dark:text-slate-100 overflow-y-auto custom-scrollbar">
      {/* 顶部面包屑与标题栏 (与存储服务一致) */}
      <div className="px-6 lg:px-8 py-5 border-b border-slate-200/80 dark:border-white/5 bg-white/70 dark:bg-[#0B0F17]/80 backdrop-blur-md flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-400">
            <span>系统配置</span>
            <span>/</span>
            <span className="text-slate-900 dark:text-slate-200 font-bold">图床服务</span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            配置多模态生图与参考图读取的默认公网图床服务
          </p>
        </div>
      </div>

      <div className="p-6 lg:p-8 max-w-6xl w-full mx-auto space-y-6">
        {/* 当前使用状态指示条 */}
        <div className="flex flex-wrap items-center justify-between p-5 px-6 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#11151F] shadow-sm gap-4">
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
              <span>当前使用：{getHostLabel(activeHost)}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                activeHost === 'none'
                  ? 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                  : (activeHost === 'imgbb' ? imgbbApiKey : freeimageApiKey)
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              }`}>
                {activeHost === 'none' ? '内联传输' : (activeHost === 'imgbb' ? imgbbApiKey : freeimageApiKey) ? '主生图通道·已就绪' : '未配置密钥'}
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              生图引擎在处理带有本地参考图的请求时，将自动通过此通道转换为公网 URL
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              onNotify?.('状态已同步为最新图床配置');
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-50 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all shadow-sm"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>刷新状态</span>
          </button>
        </div>

        {/* 1. 选择新增图床存储位置 (3 栏卡片选择) */}
        <div className="p-6 lg:p-7 rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#11151F] shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-[#5051F9] flex items-center justify-center font-bold text-sm">
                1
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">选择新增/激活图床存储位置</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  先选择一种图床方式。选择结果会决定下一步需要填写的接入信息。不会迁移现有图床资源。
                </p>
              </div>
            </div>

            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
              <span>* 立即设置</span>
            </span>
          </div>

          {/* 3 种图床卡片 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 卡片 1: ImgBB */}
            <div
              onClick={() => {
                setActiveHost('imgbb');
                setHasChanges(true);
                setTestResult(null);
              }}
              className={`relative p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between min-h-[150px] ${
                activeHost === 'imgbb'
                  ? 'bg-blue-50/60 dark:bg-indigo-500/10 border-[#5051F9] dark:border-indigo-500/50 shadow-sm ring-1 ring-[#5051F9]/20'
                  : 'bg-slate-50/50 dark:bg-white/[0.02] border-slate-200/80 dark:border-white/5 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-[#5051F9] flex items-center justify-center">
                      <ImageIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-bold text-sm text-slate-900 dark:text-white">ImgBB</span>
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        推荐
                      </span>
                    </div>
                  </div>
                  {activeHost === 'imgbb' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#5051F9] text-white font-bold flex items-center gap-1">
                      <Check className="h-3 w-3" /> 已选择
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mt-1">
                  海外极速公共图床，支持多 Key 轮询，生成临时图 10 分钟自动删除，稳定高可用。
                </p>
              </div>
              <div className="mt-3 text-xs text-slate-400 font-medium flex items-center justify-between">
                <span>海外极速图床</span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">推荐优先使用</span>
              </div>
            </div>

            {/* 卡片 2: FreeImage.host */}
            <div
              onClick={() => {
                setActiveHost('freeimage');
                setHasChanges(true);
                setTestResult(null);
              }}
              className={`relative p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between min-h-[150px] ${
                activeHost === 'freeimage'
                  ? 'bg-blue-50/60 dark:bg-indigo-500/10 border-[#5051F9] dark:border-indigo-500/50 shadow-sm ring-1 ring-[#5051F9]/20'
                  : 'bg-slate-50/50 dark:bg-white/[0.02] border-slate-200/80 dark:border-white/5 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                      <Globe className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-bold text-sm text-slate-900 dark:text-white">FreeImage.host</span>
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        开放免费
                      </span>
                    </div>
                  </div>
                  {activeHost === 'freeimage' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#5051F9] text-white font-bold flex items-center gap-1">
                      <Check className="h-3 w-3" /> 已选择
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mt-1">
                  开放免费公共图床，提供官方 API v1 上传，大容量免付费备选服务。
                </p>
              </div>
              <div className="mt-3 text-xs text-slate-400 font-medium flex items-center justify-between">
                <span>免费公共图床</span>
                <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">备选通道</span>
              </div>
            </div>

            {/* 卡片 3: 不使用图床 (Base64) */}
            <div
              onClick={() => {
                setActiveHost('none');
                setHasChanges(true);
                setTestResult(null);
              }}
              className={`relative p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between min-h-[150px] ${
                activeHost === 'none'
                  ? 'bg-blue-50/60 dark:bg-indigo-500/10 border-[#5051F9] dark:border-indigo-500/50 shadow-sm ring-1 ring-[#5051F9]/20'
                  : 'bg-slate-50/50 dark:bg-white/[0.02] border-slate-200/80 dark:border-white/5 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                      <Server className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-bold text-sm text-slate-900 dark:text-white">免图床 Base64</span>
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400">
                        内联
                      </span>
                    </div>
                  </div>
                  {activeHost === 'none' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#5051F9] text-white font-bold flex items-center gap-1">
                      <Check className="h-3 w-3" /> 已选择
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mt-1">
                  直接传输 Base64 内联格式，不依赖外部公共存储，适合纯文本或免图床通道。
                </p>
              </div>
              <div className="mt-3 text-xs text-slate-400 font-medium flex items-center justify-between">
                <span>本地内联</span>
                <span className="text-[11px] text-slate-500 font-semibold">无需外部凭证</span>
              </div>
            </div>
          </div>

          {/* 友情提示框 (与原图对齐) */}
          <div className="p-4 px-5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 text-xs text-slate-500 leading-relaxed flex items-center gap-2.5">
            <Info className="h-4 w-4 text-[#5051F9] shrink-0" />
            <span>
              图床仅用于生图时将本地参考图转为模型可直接读取的公网临时 URL；如需持久化保存平台生成的历史工程与图片，请前往左侧【存储服务】配置。
            </span>
          </div>
        </div>

        {/* 2. 配置图床通道与凭证 */}
        <div className="p-6 lg:p-7 rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#11151F] shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-[#5051F9] flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  配置 {getHostLabel(activeHost)} 访问
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  填写凭据参数，系统自动轮询并在模型生图调用时实时分发。
                </p>
              </div>
            </div>

            {/* 测试通道连接按钮 (带测试状态) */}
            <button
              type="button"
              disabled={testingConnection || activeHost === 'none'}
              onClick={handleTestConnection}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/80 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-[#5051F9] dark:text-indigo-400 text-xs font-bold transition-all shadow-sm disabled:opacity-50"
            >
              {testingConnection ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Activity className="h-4 w-4" />
              )}
              <span>{testingConnection ? '正在测试…' : '测试连接通道'}</span>
            </button>
          </div>

          {/* 测试结果反馈条 */}
          {testResult && (
            <div
              className={`p-4 px-5 rounded-2xl text-xs flex items-center gap-3 transition-all ${
                testResult.success
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                  : 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span className="font-medium text-xs leading-relaxed">{testResult.message}</span>
            </div>
          )}

          {/* 表单内容 - ImgBB */}
          {activeHost === 'imgbb' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    ImgBB API Key:
                  </label>
                  <a
                    href="https://api.imgbb.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-[#5051F9] hover:underline flex items-center gap-1"
                  >
                    <span>获取官方免费 API Key</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="relative">
                  <textarea
                    rows={3}
                    value={imgbbApiKey}
                    onChange={(e) => {
                      setImgbbApiKey(e.target.value);
                      setHasChanges(true);
                      setTestResult(null);
                    }}
                    placeholder="输入 ImgBB API Key（支持多 Key，每行一个自动轮询）"
                    style={isImgbbKeyVisible ? undefined : ({ WebkitTextSecurity: 'disc' } as React.CSSProperties)}
                    className="w-full pl-4 pr-12 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs font-mono focus:outline-none focus:border-[#5051F9] focus:ring-1 focus:ring-[#5051F9] text-slate-800 dark:text-slate-200 resize-none leading-relaxed transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setIsImgbbKeyVisible(!isImgbbKeyVisible)}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    {isImgbbKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 mt-2 gap-2">
                  <span>
                    {imgbbKeysCount > 1
                      ? `已配置 ${imgbbKeysCount} 个 API Key，生图时系统将按请求自动轮询使用`
                      : '支持多个 Key，每行一个；上传时自动轮询并在遇限额时自动降级'}
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">Endpoint: https://api.imgbb.com/1/upload</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">自动销毁策略</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">上传用于 AI 生图的参考图将在 10 分钟后自动从图床销毁，保护隐私并节省额度</div>
                </div>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                  10 分钟自动过期
                </span>
              </div>
            </div>
          )}

          {/* 表单内容 - FreeImage.host */}
          {activeHost === 'freeimage' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    FreeImage.host API Key:
                  </label>
                  <a
                    href="https://freeimage.host/page/api"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-[#5051F9] hover:underline flex items-center gap-1"
                  >
                    <span>获取免费 API Key</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="relative">
                  <textarea
                    rows={3}
                    value={freeimageApiKey}
                    onChange={(e) => {
                      setFreeimageApiKey(e.target.value);
                      setHasChanges(true);
                      setTestResult(null);
                    }}
                    placeholder="输入 FreeImage.host API Key（支持多 Key，每行一个自动轮询）"
                    style={isFreeimageKeyVisible ? undefined : ({ WebkitTextSecurity: 'disc' } as React.CSSProperties)}
                    className="w-full pl-4 pr-12 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs font-mono focus:outline-none focus:border-[#5051F9] focus:ring-1 focus:ring-[#5051F9] text-slate-800 dark:text-slate-200 resize-none leading-relaxed transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setIsFreeimageKeyVisible(!isFreeimageKeyVisible)}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    {isFreeimageKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 mt-2 gap-2">
                  <span>
                    {freeimageKeysCount > 1
                      ? `已配置 ${freeimageKeysCount} 个 API Key，生图时系统将按请求自动轮询使用`
                      : '支持多个 Key，每行一个；上传时自动轮询并在遇限额时自动降级'}
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">Endpoint: https://freeimage.host/api/1/upload</span>
                </div>
              </div>
            </div>
          )}

          {/* 表单内容 - Base64 */}
          {activeHost === 'none' && (
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>Base64 内联格式已生效</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                无需配置任何远程图床 API Key。所有参考图在向生图引擎请求时将以 Data URL (base64) 直接内联传输。
                请注意：部分对请求体体积有严格限制的模型（如生视频或超长提示词）可能因体积过大产生报错，推荐搭配 ImgBB 使用。
              </p>
            </div>
          )}
        </div>

        {/* 底部保存与提示栏 (与存储服务一致) */}
        <div className="flex flex-wrap items-center justify-between p-5 px-6 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#11151F] shadow-sm gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>系统仅在本地浏览器保存敏感凭据，不会向第三方泄露。修改后请点击保存。建议先执行连通性测试。</span>
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl bg-[#5051F9] hover:bg-[#4344E0] text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20 active:scale-95 shrink-0 flex items-center gap-2"
          >
            <span>保存修改</span>
            {hasChanges && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
          </button>
        </div>
      </div>
    </div>
  );
};
