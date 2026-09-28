import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Download, PlusCircle, Shirt, UserRound, Sparkles, Play, XCircle, RefreshCw, Eye, MousePointer2 } from 'lucide-react';
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion';
import type { WorkflowUiMessage, Requirements, ModelGenOptions } from '../../../../types/workflow.types';
import { useClothingState, useClothingStudioChatStore } from '../../../../stores/clothingStudioChat.store';
import { PLATFORM_OPTIONS, LANGUAGE_OPTIONS, COUNT_OPTIONS, REQUIREMENT_TEMPLATES, REQUIREMENT_TAGS } from '../../../../constants/clothing-requirements';

// ----------------------------------------------------------------------
// 专业级基础组件 (Skills: ui-ux-pro-max)
// ----------------------------------------------------------------------

const ProCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => {
  const isDefaultBg = !className.includes('bg-');
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border border-gray-100 ${isDefaultBg ? 'bg-white/80 backdrop-blur-xl' : ''} p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)] ring-1 ring-black/5 ${className}`}
    >
      {children}
    </motion.div>
  );
};

const ProSelect = ({ label, value, onChange, options, className = "" }: any) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>
    {label && <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-0.5">{label}</label>}
    <div className="relative group">
      <select 
        value={value} 
        onChange={onChange}
        className="w-full appearance-none rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2 text-xs font-medium text-gray-700 outline-none transition-all hover:border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
      >
        {options.map((opt: any) => (
          <option key={opt.value || opt} value={opt.value || opt}>{opt.label || opt}</option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-blue-500 transition-colors">
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  </div>
);

const ProButton = ({ onClick, children, variant = "primary", className = "", icon: Icon }: any) => {
  const isPrimary = variant === "primary";
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`
        inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all shadow-sm
        ${isPrimary 
          ? "bg-gray-900 text-white hover:bg-black hover:shadow-lg hover:shadow-black/10" 
          : "bg-white text-gray-700 border border-gray-100 hover:bg-gray-50 hover:border-gray-200"}
        ${className}
      `}
    >
      {Icon && <Icon size={14} strokeWidth={2.5} />}
      {children}
    </motion.button>
  );
};

const ProTag = ({ active, onClick, children }: any) => (
  <motion.button
    whileHover={{ y: -1 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className={`
      rounded-full px-3 py-1 text-[11px] font-semibold transition-all border
      ${active 
        ? "bg-gray-900 text-white border-gray-900 shadow-md shadow-black/10" 
        : "bg-gray-50/50 text-gray-600 border-gray-100 hover:border-gray-300 hover:bg-white"}
    `}
  >
    {children}
  </motion.button>
);

/**
 * 视网膜级预览卡片
 */
const FloatingPreview = ({ url, visible }: { url: string; visible: boolean }) => (
  <AnimatePresence>
    {visible && (
      <motion.div
        initial={{ opacity: 0, scale: 0.9, x: 20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        exit={{ opacity: 0, scale: 0.9, x: 20 }}
        className="fixed z-[9999] pointer-events-none rounded-2xl overflow-hidden border-4 border-white shadow-2xl shadow-black/30 w-[320px] aspect-[3/4] bg-white translate-x-4 cursor-none"
        style={{ top: '20%', right: '20px' }}
      >
        <img src={url} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        <div className="absolute bottom-4 left-4 flex items-center gap-2 text-white">
          <Eye size={14} className="animate-pulse" />
          <span className="text-[10px] font-bold tracking-widest uppercase">HD PREVIEW</span>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

interface ClothingStudioCardsProps {
  message: WorkflowUiMessage;
  onSubmitRequirements: (data: Requirements) => void;
  onGenerateModel: (data: ModelGenOptions) => void;
  onPickModelCandidate: (url: string) => void;
  onInsertToCanvas: (url: string, label?: string) => void;
  onRetryFailed: () => void;
}

export const ClothingStudioCards: React.FC<ClothingStudioCardsProps> = ({
  message,
  onSubmitRequirements,
  onGenerateModel,
  onPickModelCandidate,
  onInsertToCanvas,
  onRetryFailed,
}) => {
  const state = useClothingState();
  const [form, setForm] = useState<Requirements>(state.requirements);
  const [modelForm, setModelForm] = useState<ModelGenOptions>(state.modelOptions);
  const candidateUrls = useMemo(() => state.modelCandidates.map((c) => c.url), [state.modelCandidates]);
  const [hoverUrl, setHoverUrl] = useState<string | null>(null);

  // ----------------------------------------------------------------------
  // 自动化：生成完成后自动插入画布 (User Request)
  // ----------------------------------------------------------------------
  const insertedResultUrls = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    if (message.type === 'clothingStudio.results') {
      const images = message.images?.length ? message.images : state.results;
      if (images.length > 0) {
        for (const img of images) {
          const key = String(img.url || '').trim();
          if (!key || insertedResultUrls.current.has(key)) continue;
          onInsertToCanvas(img.url, img.label);
          insertedResultUrls.current.add(key);
        }
      }
    }
  }, [message, state.results, onInsertToCanvas]);

  if (message.type === 'clothingStudio.product') {
    return (
      <ProCard>
        <div className="flex items-center gap-2 text-sm font-bold text-gray-900"><Shirt size={16} className="text-blue-500" /> 服装棚拍组图</div>
        <div className="mt-3 rounded-xl bg-blue-50/50 p-2.5 border border-blue-100/50">
           <p className="text-xs text-blue-700 leading-relaxed font-medium">请先上传产品图（{message.productCount}/{message.max}）。AI 将根据您的设计自动适配最佳角度。</p>
        </div>
      </ProCard>
    );
  }

  if (message.type === 'clothingStudio.analyzing') {
    if (state.analysis) return null; // 如果已经有分析结果，则隐藏分析中状态
    return (
      <ProCard className="bg-blue-50/30 border-blue-100">
        <div className="flex items-center gap-2 text-sm font-bold text-blue-900">
          <RefreshCw size={16} className="animate-spin" />
          正在分析产品图
        </div>
        <p className="mt-2 text-xs text-blue-700/80 leading-relaxed">正在利用视觉大模型深度识别品类、材质与版型，为您提炼产品一致性锚点...</p>
      </ProCard>
    );
  }

  if (message.type === 'clothingStudio.analysis') {
    const a = message.analysis;
    return (
      <ProCard>
        <div className="flex items-center gap-2 text-sm font-bold text-gray-900"><UserRound size={16} className="text-purple-500" /> 视觉分析概览</div>
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
          <div className="space-y-0.5">
            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Category</div>
            <div className="text-xs font-semibold text-gray-700">{a.productType} {a.isSet ? '(套装)' : ''}</div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Poses</div>
            <div className="text-xs font-semibold text-gray-700 truncate">{a.recommendedPoses.join(' / ') || '通用'}</div>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-gray-50 bg-gray-50/50 p-3">
          <div className="mb-1 text-[9px] font-bold text-gray-400 uppercase tracking-widest">Consistency Anchor</div>
          <div className="text-[11px] font-medium text-gray-600 leading-relaxed italic">"{a.anchorDescription}"</div>
        </div>
      </ProCard>
    );
  }

  if (message.type === 'clothingStudio.needModel') {
    return (
      <ProCard className="bg-amber-50/30 border-amber-100">
        <div className="flex items-center gap-2 text-sm font-bold text-amber-900"><UserRound size={16} className="text-amber-500" /> 资源缺口：模特图</div>
        <p className="mt-2 text-xs text-amber-800/80 leading-relaxed">当前未检测到模特锚点。建议上传真实拍摄或使用 AI 实验室生成的四视图锚点。</p>
        <ProButton 
          onClick={() => onGenerateModel(modelForm)}
          icon={Sparkles}
          className="mt-4 w-full !bg-amber-600 hover:!bg-amber-700 !shadow-amber-100"
        >
          即刻生成 AI 模特
        </ProButton>
      </ProCard>
    );
  }

  if (message.type === 'clothingStudio.generateModelForm') {
    return (
      <ProCard>
        <div className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-4"><Sparkles size={16} className="text-blue-500" /> 模特实验室</div>
        <div className="grid grid-cols-2 gap-3">
          <ProSelect label="Gender" value={modelForm.gender || '不限'} onChange={(e: any) => setModelForm((s) => ({ ...s, gender: e.target.value }))} options={['不限', '女性', '男性']} />
          <ProSelect label="Age" value={modelForm.ageRange || '18-25岁'} onChange={(e: any) => setModelForm((s) => ({ ...s, ageRange: e.target.value }))} options={['不限', '0-6岁', '7-12岁', '13-17岁', '18-25岁', '26-35岁', '36-50岁', '50岁+']} />
          <ProSelect label="Ethnicity" value={modelForm.skinTone || '亚洲人'} onChange={(e: any) => setModelForm((s) => ({ ...s, skinTone: e.target.value }))} options={['不限', '白人', '亚洲人', '黑人', '拉丁裔']} />
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-0.5">Quantity</label>
            <input className="rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2 text-xs font-medium outline-none focus:border-blue-500" type="number" min={1} max={4} value={modelForm.count || 1} onChange={(e) => setModelForm((s) => ({ ...s, count: Math.max(1, Math.min(4, Number(e.target.value) || 1)) }))} />
          </div>
          <ProSelect label="Pose" className="col-span-2" value={modelForm.pose || '站立正面'} onChange={(e: any) => setModelForm((s) => ({ ...s, pose: e.target.value }))} options={['站立正面', '站立45°侧身', '走路抓拍', '坐姿']} />
        </div>
        <textarea className="mt-3 w-full rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2 text-xs outline-none focus:border-blue-500 transition-all" rows={2} placeholder="更多个性化描述... (如：发色、场景)" value={modelForm.extra || ''} onChange={(e) => setModelForm((s) => ({ ...s, extra: e.target.value }))} />
        <ProButton onClick={() => onGenerateModel(modelForm)} icon={Play} className="mt-4 w-full">生成模特序列</ProButton>
      </ProCard>
    );
  }

  if (message.type === 'clothingStudio.modelCandidates') {
    const images = candidateUrls.length ? candidateUrls : message.images.map((i) => i.url);
    return (
      <ProCard>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-900"><UserRound size={16} className="text-blue-500" /> 选择视觉锚点</div>
          <div className="text-[9px] font-bold text-gray-400 uppercase bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100 flex items-center gap-1">
            <MousePointer2 size={10} /> Hover for Preview
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 relative">
          {images.map((url, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -4, boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)" }}
              onMouseEnter={() => setHoverUrl(url)}
              onMouseLeave={() => setHoverUrl(null)}
              className="group relative cursor-pointer overflow-hidden rounded-2xl border border-gray-100 bg-gray-50"
            >
              <div className="aspect-[3/4] overflow-hidden" onClick={() => onPickModelCandidate(url)}>
                <img src={url} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onPickModelCandidate(url)}>
                <div className="text-[10px] font-bold text-white text-center">点击选定</div>
              </div>
            </motion.div>
          ))}
        </div>
        <FloatingPreview url={hoverUrl || ''} visible={!!hoverUrl} />
      </ProCard>
    );
  }

  if (message.type === 'clothingStudio.requirementsForm') {
    return (
      <ProCard>
        <div className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-4"><Shirt size={16} className="text-blue-500" /> 生产规格配置</div>
        {state.modelImage ? (
          <div className="mb-4 flex items-center gap-3 rounded-2xl bg-gray-50/80 p-2.5 ring-1 ring-gray-100">
            <div className="relative h-12 w-10 shrink-0 overflow-hidden rounded-lg shadow-sm">
              <img src={state.modelImage.url} className="h-full w-full object-cover" />
              <div className="absolute inset-0 ring-1 ring-inset ring-black/5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Active Anchor</div>
              <div className="text-xs font-bold text-gray-700 truncate">已锁定模特视觉特征</div>
            </div>
          </div>
        ) : (
          <div className="mb-4 rounded-xl bg-amber-50/50 p-3 border border-amber-100/50">
            <div className="text-[10px] font-bold text-amber-700 flex items-center gap-1.5 uppercase tracking-widest"><RefreshCw size={10} className="animate-spin" /> Highly Recommended</div>
            <p className="mt-1 text-[11px] text-amber-800 leading-relaxed font-medium">建议先指定模特锚点，以确保生成的服装组图在人物面容和体态上完全一致。</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <ProSelect label="Platform" value={form.platform} onChange={(e: any) => setForm((s) => ({ ...s, platform: e.target.value }))} options={PLATFORM_OPTIONS} />
          <ProSelect label="Preset" value={form.templateId || 'ecom_clean'} onChange={(e: any) => {
            const tpl = REQUIREMENT_TEMPLATES.find(t => t.id === e.target.value);
            setForm((s) => ({ ...s, templateId: e.target.value, description: tpl?.text || s.description }));
          }} options={REQUIREMENT_TEMPLATES} />
          <ProSelect 
            label="Ratio" 
            value={form.aspectRatio} 
            onChange={(e: any) => setForm((s) => ({ ...s, aspectRatio: e.target.value }))} 
            options={['1:1', '3:4', '4:3', '9:16', '16:9']} 
          />
          <ProSelect
            label="Res."
            value={form.clarity}
            options={['1K', '2K', '4K']}
            onChange={(e: any) => setForm((s) => ({ ...s, clarity: e.target.value }))}
          />
          <ProSelect
            label="Language"
            value={form.targetLanguage}
            onChange={(e: any) => setForm((s) => ({ ...s, targetLanguage: e.target.value }))}
            options={LANGUAGE_OPTIONS}
          />
          <ProSelect
            label="Count"
            value={form.count}
            onChange={(e: any) => setForm((s) => ({ ...s, count: Math.max(1, Math.min(10, Number(e.target.value) || 1)) }))}
            options={COUNT_OPTIONS}
          />
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <div className="mb-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-0.5">Atmosphere Tags</div>
            <div className="flex flex-wrap gap-1.5">
              {REQUIREMENT_TAGS.style.map(tag => (
                <ProTag key={tag} active={form.styleTags?.includes(tag)} onClick={() => setForm((s) => ({ ...s, styleTags: s.styleTags?.includes(tag) ? (s.styleTags || []).filter(t => t !== tag) : [...(s.styleTags || []), tag] }))}>{tag}</ProTag>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-0.5">Shot List</div>
            <div className="flex flex-wrap gap-1.5">
              {[...REQUIREMENT_TAGS.background, ...REQUIREMENT_TAGS.camera, ...REQUIREMENT_TAGS.focus].map(tag => (
                <ProTag
                  key={tag}
                  active={
                    form.backgroundTags?.includes(tag) ||
                    form.cameraTags?.includes(tag) ||
                    form.focusTags?.includes(tag)
                  }
                  onClick={() => setForm((s) => {
                    const inBg = REQUIREMENT_TAGS.background.includes(tag as any);
                    const inCam = REQUIREMENT_TAGS.camera.includes(tag as any);
                    const key = inBg ? 'backgroundTags' : inCam ? 'cameraTags' : 'focusTags';
                    const prev = (s[key] || []) as string[];
                    const next = prev.includes(tag)
                      ? prev.filter((t) => t !== tag)
                      : [...prev, tag];
                    return { ...s, [key]: next } as Requirements;
                  })}
                >
                  {tag}
                </ProTag>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6">
           <textarea className="w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-4 py-3 text-xs leading-relaxed outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner" rows={3} placeholder="详细描述..." value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} />
        </div>

        <ProButton onClick={() => onSubmitRequirements({ ...form, count: Math.max(1, Math.min(10, form.count || 1)) })} icon={Play} className="mt-6 w-full py-3.5 !text-sm">启动生产引擎</ProButton>
      </ProCard>
    );
  }

  if (message.type === 'clothingStudio.progress') {
    const pct = message.total > 0 ? Math.round((message.done / message.total) * 100) : 0;
    return (
      <ProCard className="bg-gradient-to-br from-blue-600 to-blue-700 border-none !text-white overflow-hidden relative shadow-lg shadow-blue-200/50">
        <div className="absolute top-0 left-0 h-full bg-white/20 transition-all duration-1000" style={{ width: `${pct}%` }} />
        <div className="relative z-10 flex flex-col items-center py-2">
           <div className="text-sm font-black italic tracking-tighter drop-shadow-sm">RENDER IN PROGRESS {pct}%</div>
           <p className="mt-1 text-[10px] opacity-90 font-bold uppercase tracking-widest">{message.text || 'Processing visual layers...'}</p>
           <div className="mt-4 flex gap-3">
              <button 
                onClick={() => useClothingStudioChatStore.getState().actions.cancelGenerating()} 
                className="text-[10px] font-bold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full backdrop-blur-md transition-all active:scale-95"
              >
                ABORT
              </button>
              <button
                onClick={onRetryFailed}
                disabled={!state.failedItems.length}
                className="text-[10px] font-bold bg-black/20 hover:bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-md transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                RETRY FAILED
              </button>
           </div>
        </div>
      </ProCard>
    );
  }

  if (message.type === 'clothingStudio.results') {
    const images = (message.images && message.images.length > 0) ? message.images : state.results;
    
    // 如果真的没有任何图片，显示增强型的加载态，而不是“假按钮”
    if (images.length === 0) {
      return (
        <ProCard className="bg-gray-50/50 border-dashed border-gray-200 py-8">
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="relative">
              <RefreshCw size={24} className="animate-spin text-blue-500 opacity-40" />
              <Sparkles size={12} className="absolute -top-1 -right-1 text-blue-400 animate-pulse" />
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Finalizing Visuals</span>
              <p className="text-[9px] text-gray-400 font-medium mt-1">AI 正在封装高清图层，请稍后...</p>
            </div>
          </div>
        </ProCard>
      );
    }

    return (
      <ProCard className="overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
            <div className="bg-green-100 p-1.5 rounded-lg"><PlusCircle size={14} className="text-green-600" /></div>
            生产成果：高清样片
          </div>
          <div className="px-2 py-0.5 rounded-full bg-green-50 border border-green-100 text-[9px] font-bold text-green-600 uppercase">Success</div>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {images.map((img, idx) => (
            <motion.div 
              key={`${img.url}-${idx}`} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 shadow-sm"
            >
              <div className="relative aspect-[3/4] overflow-hidden">
                <img src={img.url} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                   <ProButton onClick={() => onInsertToCanvas(img.url, img.label)} className="!py-1.5 !px-3 shadow-xl !bg-white !text-gray-900">插入画布</ProButton>
                   <a href={img.url} download className="text-[10px] text-white font-bold underline decoration-white/30 hover:decoration-white transition-all">下载原图</a>
                </div>
              </div>
              <div className="px-3 py-2 bg-white flex items-center justify-between">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">HD Output</span>
                <Sparkles size={10} className="text-blue-400" />
              </div>
            </motion.div>
          ))}
        </div>
      </ProCard>
    );
  }

  return null;
};
