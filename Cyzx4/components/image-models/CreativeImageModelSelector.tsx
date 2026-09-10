import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Cpu, Loader2, RefreshCw, Search, Star, X } from 'lucide-react';
import {
  getVirseImageQuality,
  listVirseImageModels,
  setVirseImageQuality,
  supportsVirseImageQuality,
  VIRSE_IMAGE_QUALITY_OPTIONS,
  type VirseImageModel,
  type VirseImageQuality,
} from '../../../services/virseService';
import {
  buildCreativeImageModels,
  CREATIVE_IMAGE_MODEL_PREFERENCE_EVENT,
  getCreativeImageModel,
  getPreferredCreativeImageModelId,
  IMAGE_MODEL_PROVIDERS,
  setPreferredCreativeImageModelId,
  type ImageModelProviderId,
} from './imageModelRegistry';
import {
  channelModelCacheKey,
  resolveActiveImageGenerationChannel,
  type ImageGenerationChannel,
} from './imageGenerationChannels';

const readCachedModels = (channel: ImageGenerationChannel): VirseImageModel[] => {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(channelModelCacheKey(channel.id)) || '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => item?.id) : [];
  } catch {
    return [];
  }
};

const IMAGE_MODEL_PATTERN = /image|imagen|banana|gemini.*(?:flash|pro).*image|gpt[-_. ]?image|midjourney|(?:^|[-_. ])mj(?:[-_. ]|$)|flux|seedream|doubao|qwen|ideogram/i;

const listChannelImageModels = async (channel: ImageGenerationChannel): Promise<VirseImageModel[]> => {
  if (!channel.apiKey) throw new Error(`${channel.label}尚未配置 API Key`);
  if (channel.id === 'virse') {
    return listVirseImageModels(channel.apiKey, channel.baseUrl || 'https://api.virse.ai');
  }

  const root = (channel.baseUrl || 'https://generativelanguage.googleapis.com')
    .trim().replace(/\/+$/, '').replace(/\/v1(?:beta)?$/i, '');
  const plans = channel.id === 'native'
    ? [{ url: `${root}/v1beta/models?key=${encodeURIComponent(channel.apiKey)}`, headers: {} }]
    : [
        { url: `${root}/v1/models`, headers: { Authorization: `Bearer ${channel.apiKey}` } },
        { url: `${root}/v1beta/models?key=${encodeURIComponent(channel.apiKey)}`, headers: {} },
        { url: `${root}/models`, headers: { Authorization: `Bearer ${channel.apiKey}` } },
      ];
  let lastError = '';
  for (const plan of plans) {
    try {
      const response = await fetch(plan.url, { headers: { Accept: 'application/json', ...plan.headers } });
      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
        continue;
      }
      const payload = await response.json();
      const raw = payload?.models || payload?.data || payload?.items || (Array.isArray(payload) ? payload : []);
      const models = (Array.isArray(raw) ? raw : []).map((item: any) => {
        const id = String(typeof item === 'string' ? item : (item?.id || item?.name || item?.model || '')).replace(/^models\//, '');
        return {
          id,
          name: typeof item === 'string' ? item : (item?.display_name || item?.displayName || item?.name || item?.id || id),
          provider: typeof item === 'string' ? undefined : (item?.owned_by || item?.provider || item?.organization),
          max_resolution: typeof item === 'string' ? undefined : (item?.max_resolution || item?.resolution),
        } as VirseImageModel;
      }).filter((model: VirseImageModel) => model.id && IMAGE_MODEL_PATTERN.test(`${model.id} ${model.name || ''}`));
      if (models.length > 0) return models;
      lastError = '接口未返回图片模型';
    } catch (error) {
      lastError = error instanceof Error ? error.message : '网络请求失败';
    }
  }
  throw new Error(`${channel.label}型号同步失败：${lastError || '未知错误'}`);
};

interface CreativeImageModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
  title?: string;
  description?: string;
  compact?: boolean;
  className?: string;
  allowedProviders?: ImageModelProviderId[];
}

const CreativeImageModelSelector: React.FC<CreativeImageModelSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  title = '图像生成模型',
  description = '先选择模型厂商，再选择当前图片通道支持的具体型号',
  compact = false,
  className = '',
  allowedProviders,
}) => {
  const [channel, setChannel] = useState(resolveActiveImageGenerationChannel);
  const [remoteModels, setRemoteModels] = useState<VirseImageModel[]>(() => readCachedModels(resolveActiveImageGenerationChannel()));
  const [activeProvider, setActiveProvider] = useState<ImageModelProviderId | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [preferredModelId, setPreferredModelId] = useState(() => getPreferredCreativeImageModelId(resolveActiveImageGenerationChannel().id));
  const [imageQualities, setImageQualities] = useState<Record<string, VirseImageQuality>>({});
  const syncedChannel = useRef<string>('');

  const models = useMemo(() => buildCreativeImageModels(remoteModels, channel.id), [remoteModels, channel.id]);
  const visibleModels = useMemo(() => models.filter((model) => !allowedProviders || allowedProviders.includes(model.provider)), [allowedProviders, models]);
  const selectedModel = getCreativeImageModel(value, visibleModels);
  const preferredModel = getCreativeImageModel(preferredModelId, visibleModels);
  const providers = useMemo(() => IMAGE_MODEL_PROVIDERS.filter((provider) => visibleModels.some((model) => model.provider === provider.id)), [visibleModels]);
  const activeModels = useMemo(() => visibleModels.filter((model) => (
    model.provider === activeProvider
    && (!query.trim() || `${model.name} ${model.id} ${model.providerLabel}`.toLowerCase().includes(query.trim().toLowerCase()))
  )), [activeProvider, visibleModels, query]);

  const syncChannelModels = async (nextChannel = channel) => {
    if (!nextChannel.configured || nextChannel.id === 'env') return;
    setLoading(true);
    setLoadError('');
    try {
      const next = await listChannelImageModels(nextChannel);
      setRemoteModels(next);
      localStorage.setItem(channelModelCacheKey(nextChannel.id), JSON.stringify(next));
      syncedChannel.current = nextChannel.id;
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : `${nextChannel.label}型号同步失败`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeProvider) return;
    setQuery('');
    if (syncedChannel.current !== channel.id) void syncChannelModels();
  }, [activeProvider, channel.id]);

  useEffect(() => {
    const handleSettingsUpdate = () => {
      const nextChannel = resolveActiveImageGenerationChannel();
      setChannel(nextChannel);
      setRemoteModels(readCachedModels(nextChannel));
      setPreferredModelId(getPreferredCreativeImageModelId(nextChannel.id));
      setActiveProvider(null);
      setLoadError('');
      syncedChannel.current = '';
    };
    window.addEventListener('api-settings-updated', handleSettingsUpdate);
    window.addEventListener('storage', handleSettingsUpdate);
    return () => {
      window.removeEventListener('api-settings-updated', handleSettingsUpdate);
      window.removeEventListener('storage', handleSettingsUpdate);
    };
  }, []);

  useEffect(() => {
    if (visibleModels.length === 0) return;
    const currentSupported = visibleModels.some((model) => model.id === value || (value === 'nanobananapro' && model.id === 'gemini-3-pro-image-preview'));
    if (currentSupported) return;
    const preferred = getPreferredCreativeImageModelId(channel.id);
    const next = visibleModels.find((model) => model.id === preferred) || visibleModels[0];
    if (next && next.id !== value) onChange(next.id);
  }, [channel.id, onChange, value, visibleModels]);

  useEffect(() => {
    const handlePreferenceUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ channelId?: string; modelId?: string }>).detail;
      if (detail?.channelId !== channel.id) return;
      const modelId = detail.modelId || getPreferredCreativeImageModelId(channel.id);
      setPreferredModelId(modelId);
      if (visibleModels.some((model) => model.id === modelId) && modelId !== value) onChange(modelId);
    };
    window.addEventListener(CREATIVE_IMAGE_MODEL_PREFERENCE_EVENT, handlePreferenceUpdate);
    return () => window.removeEventListener(CREATIVE_IMAGE_MODEL_PREFERENCE_EVENT, handlePreferenceUpdate);
  }, [channel.id, onChange, value, visibleModels]);

  return (
    <>
      <section className={`rounded-2xl border border-pastel-border bg-pastel-card p-4 shadow-sm ${className}`}>
        {title && <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-950"><Cpu className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-black text-pastel-text">{title}</h2><span className="rounded-full border border-pastel-border px-2 py-0.5 text-[0.65rem] font-bold text-pastel-muted">当前通道：{channel.label}</span></div>{!compact && <p className="mt-0.5 text-xs text-pastel-muted">{description}</p>}</div>
        </div>}
        {!title && <div className="mb-2 text-[0.68rem] font-bold text-pastel-muted">当前通道：{channel.label}</div>}
        <div className={`${title ? 'mt-3' : ''} grid gap-2 ${compact ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-5'}`}>
          {providers.map((provider) => {
            const providerModels = visibleModels.filter((model) => model.provider === provider.id);
            const selected = selectedModel.provider === provider.id;
            return <button key={provider.id} type="button" disabled={disabled} onClick={() => setActiveProvider(provider.id)} className={`group relative min-h-16 cursor-pointer rounded-xl border px-3 py-2 text-left transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${selected ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950' : 'border-pastel-border bg-pastel-bg text-pastel-text hover:border-slate-400'}`}>
              <span className="block truncate text-xs font-black">{selected ? selectedModel.name : provider.shortLabel}</span>
              <span className={`mt-1 block truncate text-[0.65rem] ${selected ? 'text-white/70 dark:text-slate-600' : 'text-pastel-muted'}`}>{selected ? provider.label : `${providerModels.length} 个型号`}</span>
              <ChevronRight className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-45" />
            </button>;
          })}
        </div>
      </section>

      {activeProvider && <div className="fixed inset-0 z-[240] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label="选择图像生成模型" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveProvider(null); }}>
        <div className="flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-3xl dark:border-white/10 dark:bg-[#111318]">
          <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10">
            <div><p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-slate-500">选择具体型号</p><h3 className="mt-1 text-lg font-black text-slate-950 dark:text-white">{IMAGE_MODEL_PROVIDERS.find((item) => item.id === activeProvider)?.label}</h3><p className="mt-1 text-xs text-slate-500">通过 {channel.label} 生成 · 默认：{preferredModel.name}</p></div>
            <div className="flex items-center gap-1"><button type="button" onClick={() => void syncChannelModels()} disabled={loading || !channel.configured} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/10" aria-label={`刷新${channel.label}支持的模型`}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button><button type="button" onClick={() => setActiveProvider(null)} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-white/10" aria-label="关闭"><X className="h-5 w-5" /></button></div>
          </header>
          <div className="border-b border-slate-200 px-5 py-3 dark:border-white/10"><label className="relative block"><span className="sr-only">搜索模型名称或 ID</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索模型名称或 ID" className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-slate-500 dark:border-white/10 dark:bg-white/5" /></label></div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-5">
            {loading && activeModels.length === 0 && <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />正在同步 {channel.label} 的型号…</div>}
            {activeModels.map((model) => {
              const selected = model.id === value || (value === 'nanobananapro' && model.id === 'gemini-3-pro-image-preview');
              const preferred = model.id === preferredModelId;
              const supportsQuality = channel.id === 'virse' && supportsVirseImageQuality(model.id);
              const quality = imageQualities[model.id] || getVirseImageQuality(model.id);
              const selectModel = () => { onChange(model.id); if (channel.id === 'virse') localStorage.setItem('virse_model', model.id); setActiveProvider(null); };
              const makeDefault = () => { setPreferredModelId(model.id); if (channel.id === 'virse') localStorage.setItem('virse_model', model.id); setPreferredCreativeImageModelId(channel.id, model.id); };
              return <div key={`${channel.id}-${model.id}`} className={`rounded-2xl border p-2 transition-colors ${selected ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950' : 'border-slate-200 hover:border-slate-400 dark:border-white/10 dark:hover:border-white/30'}`}>
                <div className="flex min-h-12 items-center gap-2">
                  <button type="button" onClick={selectModel} className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-3 rounded-xl px-2 py-1 text-left">
                    <span className="min-w-0"><strong className="block truncate text-sm font-black">{model.name}</strong><small className={`mt-1 block truncate text-xs ${selected ? 'text-white/65 dark:text-slate-600' : 'text-slate-500'}`}>{model.description} · {channel.label}</small></span>
                    {selected && <Check className="h-5 w-5 shrink-0" />}
                  </button>
                  <button type="button" onClick={makeDefault} className={`flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border px-3 text-xs font-black transition-colors ${preferred ? 'border-slate-500 bg-slate-100 text-slate-900 dark:border-white/30 dark:bg-white/10 dark:text-white' : selected ? 'border-white/20 text-white/75 hover:bg-white/10 dark:border-slate-300 dark:text-slate-600' : 'border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10'}`} aria-label={preferred ? `${model.name} 已是当前通道默认模型` : `将 ${model.name} 设为当前通道默认模型`}><Star className={`h-3.5 w-3.5 ${preferred ? 'fill-current' : ''}`} />{preferred ? '默认' : '设为默认'}</button>
                </div>
                {selected && supportsQuality && <div className="mt-2 flex items-center justify-between gap-3 border-t border-white/10 px-2 pb-1 pt-2 dark:border-slate-200">
                  <span className="min-w-0"><strong className="block text-xs font-black">生成强度</strong><small className="mt-0.5 block text-[0.65rem] text-white/55 dark:text-slate-500">影响细节与渲染投入</small></span>
                  <label className="relative shrink-0">
                    <span className="sr-only">{model.name} 生成强度</span>
                    <select
                      value={quality}
                      disabled={disabled}
                      onChange={(event) => {
                        const nextQuality = event.target.value as VirseImageQuality;
                        setVirseImageQuality(model.id, nextQuality);
                        setImageQualities((current) => ({ ...current, [model.id]: nextQuality }));
                      }}
                      className="min-h-9 w-28 cursor-pointer appearance-none rounded-xl border border-white/15 bg-white/10 py-1 pl-3 pr-8 text-xs font-black text-white outline-none transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-300 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 dark:focus-visible:ring-slate-500"
                    >
                      {VIRSE_IMAGE_QUALITY_OPTIONS.map((option) => <option key={option.value} value={option.value} className="bg-white text-slate-900">{option.label}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-60" />
                  </label>
                </div>}
              </div>;
            })}
            {!loading && activeModels.length === 0 && <p className="py-12 text-center text-sm text-slate-500">当前通道没有匹配的模型，请检查通道配置或刷新型号。</p>}
            {remoteModels.length === 0 && !loading && <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">尚未从通道读取到型号，当前展示兼容预设。刷新后将以 {channel.label} 实际返回的图片型号为准。</p>}
            {loadError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">{loadError}</p>}
          </div>
        </div>
      </div>}
    </>
  );
};

export default CreativeImageModelSelector;
