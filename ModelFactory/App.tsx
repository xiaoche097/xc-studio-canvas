import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, Aperture, ArrowLeft, Brush, Check, ChevronDown, ChevronRight, CircleHelp,
  Copy, Crop, Download, Eraser, Eye, Focus, Grid3X3, Image as ImageIcon, Images,
  Library, Lock, Maximize2, Menu, MoreHorizontal, MoveHorizontal, Palette, Plus, Redo2, RotateCcw,
  Save, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Trash2, Undo2,
  UploadCloud, Wand2, X, Zap,
} from 'lucide-react';
import './photographyLab.css';

type LabView = 'studio' | 'looks' | 'create';
type LabImage = { id: string; name: string; src: string };
type LookPreset = {
  id: string; name: string; description: string; cover: string; referenceCount: number;
  tags: string[]; filter: string; created?: boolean;
};
type AdjustmentState = {
  temperature: number; tint: number; exposure: number; contrast: number;
  highlights: number; shadows: number; whites: number; blacks: number;
  texture: number; clarity: number; dehaze: number; vibrance: number;
  saturation: number; sharpness: number; noiseReduction: number; grain: number; vignette: number;
};
type AdjustmentKey = keyof AdjustmentState;

const BUILT_IN_LOOKS: LookPreset[] = [
  { id: 'costa-135', name: 'COSTA 135', description: 'Mediterranean Sun Film', cover: '/official_model_anna.jpg', referenceCount: 6, tags: ['暖阳', '灰青', '35mm 颗粒'], filter: 'sepia(.16) saturate(1.06) contrast(1.08) brightness(1.02) hue-rotate(-4deg)' },
  { id: 'soho-800', name: 'SOHO 800', description: 'Downtown Flash', cover: '/official_model_gabi.jpg', referenceCount: 4, tags: ['直闪', '深黑', '高反差'], filter: 'saturate(.82) contrast(1.22) brightness(.96)' },
  { id: 'milano-400', name: 'MILANO 400', description: 'Italian City Editorial', cover: '/official_model_clara.png', referenceCount: 8, tags: ['奶油肤色', '柔光', '编辑感'], filter: 'sepia(.12) saturate(.9) contrast(1.05) brightness(1.04)' },
  { id: 'paris-200', name: 'PARIS 200', description: 'Soft Overcast Film', cover: '/official_model_2.png', referenceCount: 5, tags: ['阴天', '低饱和', '柔和高光'], filter: 'saturate(.72) contrast(.93) brightness(1.06) hue-rotate(3deg)' },
];

const DEMO_PHOTOS: LabImage[] = [
  { id: 'demo-clara', name: 'Portrait 01', src: '/official_model_clara.png' },
  { id: 'demo-anna', name: 'Portrait 02', src: '/official_model_anna.jpg' },
  { id: 'demo-gabi', name: 'Portrait 03', src: '/official_model_gabi.jpg' },
];

const ANALYSIS_STEPS = ['正在读取光线方向…', '正在匹配色彩响应…', '正在分析胶片纹理…', '正在构建相机特征…', '正在生成你的摄影预设…'];
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const getInitialLooks = (): LookPreset[] => {
  try {
    const saved = JSON.parse(localStorage.getItem('xcai-look-presets') ?? '[]') as LookPreset[];
    return [...saved.filter((look) => look?.id && look?.name), ...BUILT_IN_LOOKS];
  } catch {
    return BUILT_IN_LOOKS;
  }
};
const readImages = async (files: File[], limit: number): Promise<LabImage[]> =>
  Promise.all(files.filter((file) => file.type.startsWith('image/')).slice(0, limit).map((file) =>
    new Promise<LabImage>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ id: makeId(), name: file.name, src: String(reader.result) });
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    })));

const NavButton: React.FC<{ active: boolean; icon: React.ReactNode; label: string; onClick: () => void }> =
  ({ active, icon, label, onClick }) => (
    <button className={`lab-nav-button ${active ? 'is-active' : ''}`} onClick={onClick} type="button">
      {icon}<span>{label}</span>
    </button>
  );

const Toggle: React.FC<{ checked: boolean; onChange: () => void; label: string }> = ({ checked, onChange, label }) => (
  <button aria-label={label} aria-pressed={checked} className={`lab-toggle ${checked ? 'is-on' : ''}`} onClick={onChange} type="button"><span /></button>
);

const RawSlider: React.FC<{
  label: string; value: number; min?: number; max?: number; step?: number;
  tone?: 'temperature' | 'tint'; onChange: (value: number) => void;
}> = ({ label, value, min = -100, max = 100, step = 1, tone, onChange }) => (
  <label className={`raw-slider ${tone ? `is-${tone}` : ''}`}>
    <span>{label}</span>
    <input aria-label={label} max={max} min={min} onChange={(event) => onChange(Number(event.target.value))} step={step} type="range" value={value} />
    <input aria-label={`${label}数值`} inputMode="decimal" max={max} min={min} onChange={(event) => onChange(Number(event.target.value))} onDoubleClick={() => onChange(0)} step={step} type="number" value={value} />
  </label>
);

const RawPanel: React.FC<{
  title: string; icon: React.ReactNode; open: boolean; onToggle: () => void;
  badge?: string; children?: React.ReactNode;
}> = ({ title, icon, open, onToggle, badge, children }) => (
  <section className={`raw-panel ${open ? 'is-open' : ''}`}>
    <button aria-expanded={open} className="raw-panel-trigger" onClick={onToggle} type="button">
      <span>{icon}<b>{title}</b>{badge ? <em>{badge}</em> : null}</span><ChevronDown />
    </button>
    {open ? <div className="raw-panel-content">{children}</div> : null}
  </section>
);

const RawHistogram = () => (
  <div className="raw-histogram" aria-label="RGB 亮度直方图" role="img">
    <svg preserveAspectRatio="none" viewBox="0 0 320 108">
      <path className="raw-histogram-blue" d="M0 106 L0 96 L14 91 L28 96 L44 79 L60 88 L76 72 L92 80 L108 54 L124 66 L140 32 L156 54 L172 28 L188 48 L204 19 L220 36 L236 58 L252 48 L268 73 L284 67 L300 91 L320 96 L320 108 Z" />
      <path className="raw-histogram-green" d="M0 108 L0 101 L18 96 L36 83 L54 89 L72 65 L90 73 L108 48 L126 60 L144 21 L162 45 L180 17 L198 39 L216 34 L234 58 L252 61 L270 81 L288 79 L306 99 L320 102 L320 108 Z" />
      <path className="raw-histogram-red" d="M0 108 L0 103 L18 100 L36 91 L54 96 L72 82 L90 87 L108 69 L126 74 L144 43 L162 61 L180 36 L198 54 L216 27 L234 49 L252 69 L270 74 L288 91 L306 97 L320 103 L320 108 Z" />
    </svg>
    <button aria-label="显示阴影剪切" className="raw-clip is-shadow" type="button" /><button aria-label="显示高光剪切" className="raw-clip is-highlight" type="button" />
  </div>
);

const EmptyDropZone: React.FC<{ title: string; description: string; onClick: () => void; onDrop: (files: File[]) => void }> =
  ({ title, description, onClick, onDrop }) => {
    const [isDragging, setIsDragging] = useState(false);
    return (
      <button
        className={`lab-drop-zone ${isDragging ? 'is-dragging' : ''}`}
        onClick={onClick}
        onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
        onDragLeave={(event) => { event.preventDefault(); setIsDragging(false); }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); setIsDragging(false); onDrop(Array.from(event.dataTransfer.files)); }}
        type="button"
      >
        <span className="lab-drop-icon"><UploadCloud /></span><strong>{title}</strong><span>{description}</span>
      </button>
    );
  };

const ModelFactoryApp: React.FC = () => {
  const [view, setView] = useState<LabView>('studio');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [looks, setLooks] = useState<LookPreset[]>(getInitialLooks);
  const [selectedLookId, setSelectedLookId] = useState(BUILT_IN_LOOKS[0].id);
  const [photos, setPhotos] = useState<LabImage[]>(DEMO_PHOTOS);
  const [activePhotoId, setActivePhotoId] = useState(DEMO_PHOTOS[0].id);
  const [references, setReferences] = useState<LabImage[]>([]);
  const [analysisStep, setAnalysisStep] = useState(-1);
  const [createdLook, setCreatedLook] = useState<LookPreset | null>(null);
  const [presetSaved, setPresetSaved] = useState(false);
  const [strength, setStrength] = useState(82);
  const [comparison, setComparison] = useState(58);
  const [lightMatch, setLightMatch] = useState(false);
  const [lookLock, setLookLock] = useState(true);
  const [contentLock, setContentLock] = useState(true);
  const [openPanels, setOpenPanels] = useState<string[]>(['ai-look', 'light', 'color']);
  const [adjustments, setAdjustments] = useState<AdjustmentState>({
    temperature: 6, tint: 0, exposure: 0, contrast: 8, highlights: -12, shadows: 8,
    whites: 0, blacks: -4, texture: 0, clarity: 0, dehaze: 0, vibrance: 10,
    saturation: 0, sharpness: 25, noiseReduction: 0, grain: 18, vignette: 0,
  });
  const [isApplied, setIsApplied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const targetInputRef = useRef<HTMLInputElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const comparisonFrameRef = useRef<HTMLDivElement>(null);

  const selectedLook = useMemo(() => looks.find((look) => look.id === selectedLookId) ?? looks[0], [looks, selectedLookId]);
  const activePhoto = useMemo(() => photos.find((photo) => photo.id === activePhotoId) ?? photos[0], [activePhotoId, photos]);
  const editedFilter = useMemo(() => {
    const brightness = Math.max(0.5, 1 + adjustments.exposure / 100);
    const contrast = Math.max(0.5, 1 + adjustments.contrast / 100);
    const saturation = Math.max(0, 1 + (adjustments.saturation + adjustments.vibrance * 0.5) / 100);
    return `${selectedLook?.filter ?? ''} brightness(${brightness}) contrast(${contrast}) saturate(${saturation}) sepia(${Math.max(0, adjustments.temperature) / 500})`;
  }, [adjustments.contrast, adjustments.exposure, adjustments.saturation, adjustments.temperature, adjustments.vibrance, selectedLook]);

  const updateAdjustment = useCallback((key: AdjustmentKey, value: number) => {
    setAdjustments((current) => ({ ...current, [key]: value }));
    setIsApplied(false);
  }, []);
  const togglePanel = useCallback((panel: string) => {
    setOpenPanels((current) => current.includes(panel) ? current.filter((item) => item !== panel) : [...current, panel]);
  }, []);

  const addTargetPhotos = useCallback(async (files: File[]) => {
    const next = await readImages(files, Math.max(0, 20 - photos.length));
    if (!next.length) return;
    setPhotos((current) => [...current, ...next]);
    setActivePhotoId(next[0].id);
    setIsApplied(false);
  }, [photos.length]);

  const addReferences = useCallback(async (files: File[]) => {
    const next = await readImages(files, Math.max(0, 12 - references.length));
    if (!next.length) return;
    setReferences((current) => [...current, ...next]);
    setCreatedLook(null);
    setPresetSaved(false);
  }, [references.length]);

  useEffect(() => {
    const savedLooks = looks.filter((look) => look.created).map((look) => ({
      ...look,
      cover: look.cover.startsWith('data:') ? '/official_model_anna.jpg' : look.cover,
    }));
    localStorage.setItem('xcai-look-presets', JSON.stringify(savedLooks));
  }, [looks]);

  useEffect(() => {
    if (analysisStep < 0) return;
    if (analysisStep < ANALYSIS_STEPS.length) {
      const timer = window.setTimeout(() => setAnalysisStep((current) => current + 1), 760);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      setCreatedLook({
        id: `custom-${makeId()}`,
        name: ['RIVIERA 250', 'SIENA 320', 'MONO 640'][looks.length % 3],
        description: 'Warm Editorial Daylight',
        cover: references[0]?.src ?? '/official_model_anna.jpg',
        referenceCount: references.length,
        tags: ['暖调日光', '柔和高光', '细腻颗粒'],
        filter: 'sepia(.14) saturate(.93) contrast(1.07) brightness(1.03) hue-rotate(-3deg)',
        created: true,
      });
      setAnalysisStep(-1);
    }, 420);
    return () => window.clearTimeout(timer);
  }, [analysisStep, looks.length, references]);

  const saveCreatedLook = () => {
    if (!createdLook || presetSaved) return;
    setLooks((current) => [createdLook, ...current]);
    setSelectedLookId(createdLook.id);
    setPresetSaved(true);
  };
  const applyLook = (look: LookPreset) => {
    setSelectedLookId(look.id); setView('studio'); setMobileNavOpen(false); setIsApplied(true);
  };
  const duplicateLook = (look: LookPreset) => {
    setLooks((current) => [{ ...look, id: `copy-${makeId()}`, name: `${look.name} COPY`, created: true }, ...current]);
  };
  const exportCurrent = async () => {
    if (!activePhoto) return;
    setIsExporting(true);
    try {
      const image = new window.Image();
      image.src = activePhoto.src;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.filter = editedFilter;
      context.drawImage(image, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.94));
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${selectedLook.name.toLowerCase().replace(/\s+/g, '-')}-${activePhoto.name.replace(/\.[^.]+$/, '')}.jpg`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally { setIsExporting(false); }
  };
  const resetAdjustments = () => {
    setStrength(82);
    setAdjustments({
      temperature: 6, tint: 0, exposure: 0, contrast: 8, highlights: -12, shadows: 8,
      whites: 0, blacks: -4, texture: 0, clarity: 0, dehaze: 0, vibrance: 10,
      saturation: 0, sharpness: 25, noiseReduction: 0, grain: 18, vignette: 0,
    });
    setLightMatch(false); setIsApplied(false);
  };
  const removePhoto = (id: string) => {
    setPhotos((current) => {
      const next = current.filter((photo) => photo.id !== id);
      if (id === activePhotoId) setActivePhotoId(next[0]?.id ?? '');
      return next;
    });
  };
  const updateComparisonFromPointer = useCallback((clientX: number) => {
    const frame = comparisonFrameRef.current;
    if (!frame) return;
    const bounds = frame.getBoundingClientRect();
    const next = ((clientX - bounds.left) / bounds.width) * 100;
    setComparison(Math.round(Math.min(100, Math.max(0, next))));
  }, []);
  const handleComparisonKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 1;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setComparison((current) => Math.max(0, current - step));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setComparison((current) => Math.min(100, current + step));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setComparison(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setComparison(100);
    }
  }, []);

  return (
    <div className="photography-lab">
      <input id="lab-target-input" ref={targetInputRef} aria-label="上传待处理照片" accept="image/jpeg,image/png,image/webp" className="sr-only" multiple onChange={(event) => { void addTargetPhotos(Array.from(event.target.files ?? [])); event.target.value = ''; }} type="file" />
      <input id="lab-reference-input" ref={referenceInputRef} aria-label="上传参考照片" accept="image/jpeg,image/png,image/webp" className="sr-only" multiple onChange={(event) => { void addReferences(Array.from(event.target.files ?? [])); event.target.value = ''; }} type="file" />

      <header className="lab-header">
        <div className="lab-brand-group">
          <button aria-label="返回 XcAI Studio" className="lab-icon-button lab-back" onClick={() => { window.location.href = '/'; }} title="返回工作台" type="button"><ArrowLeft /></button>
          <button className="lab-brand" onClick={() => setView('studio')} type="button">
            <span className="lab-brand-mark"><Aperture /></span><span><b>AI LOOK</b><small>摄影实验室</small></span>
          </button>
        </div>
        <nav aria-label="摄影实验室导航" className={`lab-nav ${mobileNavOpen ? 'is-open' : ''}`}>
          <NavButton active={view === 'studio'} icon={<SlidersHorizontal />} label="工作台" onClick={() => { setView('studio'); setMobileNavOpen(false); }} />
          <NavButton active={view === 'looks'} icon={<Library />} label="预设库" onClick={() => { setView('looks'); setMobileNavOpen(false); }} />
          <NavButton active={view === 'create'} icon={<Plus />} label="创建预设" onClick={() => { setView('create'); setMobileNavOpen(false); }} />
        </nav>
        <div className="lab-header-actions">
          <button className="lab-help-button" onClick={() => setView('create')} type="button"><CircleHelp /><span>使用指南</span></button>
          <button aria-label="打开导航" className="lab-icon-button lab-mobile-menu" onClick={() => setMobileNavOpen((current) => !current)} type="button">{mobileNavOpen ? <X /> : <Menu />}</button>
        </div>
      </header>

      {view === 'studio' ? (
        <main className="lab-studio">
          <aside className="lab-photo-rail">
            <div className="lab-panel-heading">
              <div><span>PHOTOS</span><strong>{photos.length} / 20</strong></div>
              <button aria-label="添加照片" onClick={() => targetInputRef.current?.click()} type="button"><Plus /></button>
            </div>
            <div className="lab-photo-list">
              {photos.map((photo, index) => (
                <button className={`lab-photo-thumb ${photo.id === activePhotoId ? 'is-active' : ''}`} key={photo.id} onClick={() => setActivePhotoId(photo.id)} type="button">
                  <img alt={photo.name} src={photo.src} /><span>{String(index + 1).padStart(2, '0')}</span>
                  <span aria-label={`移除 ${photo.name}`} className="lab-photo-remove" onClick={(event) => { event.stopPropagation(); removePhoto(photo.id); }} role="button" tabIndex={0}><X /></span>
                </button>
              ))}
              <button className="lab-add-photo" onClick={() => targetInputRef.current?.click()} type="button"><Plus /><span>添加照片</span></button>
            </div>
          </aside>

          <section className="lab-canvas-column">
            <div className="lab-canvas-toolbar">
              <div className="lab-tool-cluster" aria-label="图像工具栏">
                <button aria-label="编辑" className="is-active" title="编辑"><SlidersHorizontal /></button>
                <button aria-label="裁剪" title="裁剪"><Crop /></button>
                <button aria-label="蒙版" title="蒙版"><Brush /></button>
                <button aria-label="修复" title="修复"><Eraser /></button>
                <i />
                <button aria-label="前后对比" title="前后对比"><Eye /></button>
              </div>
              <div className="lab-document-info"><span className="lab-status-dot" /><strong>{activePhoto?.name ?? '等待照片'}</strong><span>{activePhoto ? `${selectedLook.name} · 已保护内容` : 'JPG / PNG / WEBP'}</span></div>
              <div className="lab-history-controls">
                <button aria-label="撤销" title="撤销"><Undo2 /></button><button aria-label="重做" title="重做"><Redo2 /></button>
                <button className="lab-zoom-button" type="button">适合</button><button aria-label="全屏预览" title="全屏预览"><Maximize2 /></button>
              </div>
            </div>
            <div className="lab-canvas-stage">
              {activePhoto ? (
                <div className="lab-compare-frame" ref={comparisonFrameRef}>
                  <img alt={`${activePhoto.name} 原图`} className="lab-original-image" src={activePhoto.src} />
                  <div className="lab-edited-layer" style={{ clipPath: `inset(0 ${100 - comparison}% 0 0)`, opacity: strength / 100 }}>
                    <img alt={`${activePhoto.name} 应用 ${selectedLook.name} 后`} src={activePhoto.src} style={{ filter: editedFilter }} />
                  </div>
                  <div
                    aria-label="拖动调整前后对比位置"
                    aria-orientation="horizontal"
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={comparison}
                    className="lab-compare-line"
                    onKeyDown={handleComparisonKeyDown}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.currentTarget.setPointerCapture(event.pointerId);
                      updateComparisonFromPointer(event.clientX);
                    }}
                    onPointerMove={(event) => {
                      if (event.currentTarget.hasPointerCapture(event.pointerId)) updateComparisonFromPointer(event.clientX);
                    }}
                    onPointerUp={(event) => {
                      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
                    }}
                    role="slider"
                    style={{ left: `${comparison}%` }}
                    tabIndex={0}
                  ><span><MoveHorizontal /></span></div>
                  <span className="lab-image-label is-original">原图</span><span className="lab-image-label is-edited">{selectedLook.name}</span>
                </div>
              ) : (
                <EmptyDropZone title="拖入要处理的照片" description="支持单张或批量上传，最多 20 张" onClick={() => targetInputRef.current?.click()} onDrop={(files) => void addTargetPhotos(files)} />
              )}
            </div>
            {activePhoto ? <div className="lab-comparison-control"><span>ORIGINAL</span><input aria-label="前后对比位置" max="100" min="0" onChange={(event) => setComparison(Number(event.target.value))} type="range" value={comparison} /><span>EDITED</span></div> : null}
          </section>

          <aside className="lab-control-panel">
            <div className="raw-panel-header">
              <div className="raw-mode-tabs" role="tablist" aria-label="编辑模式">
                <button aria-selected="true" className="is-active" role="tab" title="编辑"><SlidersHorizontal /></button>
                <button aria-selected="false" role="tab" title="预设" onClick={() => setView('looks')}><Grid3X3 /></button>
                <button aria-selected="false" role="tab" title="蒙版"><Brush /></button>
              </div>
              <button aria-label="更多选项" className="raw-more-button" type="button"><MoreHorizontal /></button>
            </div>
            <RawHistogram />
            <div className="raw-camera-data"><span>ISO 100</span><span>50 mm</span><span>f/2.8</span><span>1/250 秒</span></div>

            <div className="raw-panel-scroll">
              <div className="raw-profile-row">
                <span>配置文件</span><button type="button"><i style={{ backgroundImage: `url(${selectedLook.cover})` }} /><b>{selectedLook.name}</b><ChevronDown /></button>
                <select aria-label="选择配置文件" onChange={(event) => setSelectedLookId(event.target.value)} value={selectedLookId}>{looks.map((look) => <option key={look.id} value={look.id}>{look.name}</option>)}</select>
              </div>

              <RawPanel badge="AI" icon={<Sparkles />} open={openPanels.includes('ai-look')} onToggle={() => togglePanel('ai-look')} title="AI LOOK">
                <RawSlider label="预设量" max={100} min={0} onChange={setStrength} value={strength} />
                <div className="raw-ai-status"><span><i />匹配分析完成</span><b>兼容度 88%</b></div>
                <div className="raw-switch-row"><span><Zap /><b>匹配光感</b></span><Toggle checked={lightMatch} label="AI 光感匹配" onChange={() => setLightMatch((current) => !current)} /></div>
                <div className="raw-switch-row"><span><Grid3X3 /><b>整组一致</b></span><Toggle checked={lookLock} label="Look Lock" onChange={() => setLookLock((current) => !current)} /></div>
                <div className="raw-switch-row"><span><ShieldCheck /><b>保护内容</b></span><Toggle checked={contentLock} label="内容保护" onChange={() => setContentLock((current) => !current)} /></div>
              </RawPanel>

              <RawPanel icon={<Activity />} open={openPanels.includes('light')} onToggle={() => togglePanel('light')} title="光线">
                <div className="raw-auto-row"><span>白平衡</span><button type="button">原照设置 <ChevronDown /></button><button type="button">自动</button></div>
                <RawSlider label="色温" min={-100} max={100} tone="temperature" value={adjustments.temperature} onChange={(value) => updateAdjustment('temperature', value)} />
                <RawSlider label="色调" min={-100} max={100} tone="tint" value={adjustments.tint} onChange={(value) => updateAdjustment('tint', value)} />
                <div className="raw-subhead"><span>色调</span><button type="button" onClick={() => setAdjustments((current) => ({ ...current, exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0 }))}>自动</button></div>
                <RawSlider label="曝光" min={-5} max={5} step={0.05} value={adjustments.exposure} onChange={(value) => updateAdjustment('exposure', value)} />
                <RawSlider label="对比度" value={adjustments.contrast} onChange={(value) => updateAdjustment('contrast', value)} />
                <RawSlider label="高光" value={adjustments.highlights} onChange={(value) => updateAdjustment('highlights', value)} />
                <RawSlider label="阴影" value={adjustments.shadows} onChange={(value) => updateAdjustment('shadows', value)} />
                <RawSlider label="白色色阶" value={adjustments.whites} onChange={(value) => updateAdjustment('whites', value)} />
                <RawSlider label="黑色色阶" value={adjustments.blacks} onChange={(value) => updateAdjustment('blacks', value)} />
              </RawPanel>

              <RawPanel icon={<Palette />} open={openPanels.includes('color')} onToggle={() => togglePanel('color')} title="颜色">
                <RawSlider label="自然饱和度" value={adjustments.vibrance} onChange={(value) => updateAdjustment('vibrance', value)} />
                <RawSlider label="饱和度" value={adjustments.saturation} onChange={(value) => updateAdjustment('saturation', value)} />
              </RawPanel>

              <RawPanel icon={<Focus />} open={openPanels.includes('presence')} onToggle={() => togglePanel('presence')} title="效果">
                <RawSlider label="纹理" value={adjustments.texture} onChange={(value) => updateAdjustment('texture', value)} />
                <RawSlider label="清晰度" value={adjustments.clarity} onChange={(value) => updateAdjustment('clarity', value)} />
                <RawSlider label="去朦胧" value={adjustments.dehaze} onChange={(value) => updateAdjustment('dehaze', value)} />
                <RawSlider label="颗粒" min={0} max={100} value={adjustments.grain} onChange={(value) => updateAdjustment('grain', value)} />
                <RawSlider label="晕影" value={adjustments.vignette} onChange={(value) => updateAdjustment('vignette', value)} />
              </RawPanel>

              <RawPanel icon={<Activity />} open={openPanels.includes('curve')} onToggle={() => togglePanel('curve')} title="曲线">
                <div className="raw-curve-preview"><span /><i /><b /></div>
              </RawPanel>
              <RawPanel icon={<Palette />} open={openPanels.includes('mixer')} onToggle={() => togglePanel('mixer')} title="颜色混合器">
                <div className="raw-color-dots">{['#e2554f','#e99042','#d8bd4b','#63a759','#44a8a8','#4d83c5','#865fb0','#bf5f89'].map((color) => <button aria-label={`选择颜色 ${color}`} key={color} style={{ background: color }} type="button" />)}</div>
              </RawPanel>
              <RawPanel icon={<Focus />} open={openPanels.includes('detail')} onToggle={() => togglePanel('detail')} title="细节">
                <RawSlider label="锐化" min={0} max={100} value={adjustments.sharpness} onChange={(value) => updateAdjustment('sharpness', value)} />
                <RawSlider label="降噪" min={0} max={100} value={adjustments.noiseReduction} onChange={(value) => updateAdjustment('noiseReduction', value)} />
              </RawPanel>
              <RawPanel icon={<Aperture />} open={openPanels.includes('optics')} onToggle={() => togglePanel('optics')} title="光学" />
              <RawPanel icon={<Settings2 />} open={openPanels.includes('geometry')} onToggle={() => togglePanel('geometry')} title="几何" />
              <RawPanel icon={<Settings2 />} open={openPanels.includes('calibration')} onToggle={() => togglePanel('calibration')} title="校准" />
            </div>
            <div className="raw-panel-footer">
              <button aria-label="复位全部调整" onClick={resetAdjustments} title="复位全部调整" type="button"><RotateCcw /></button>
              <button className="raw-export-button" disabled={!activePhoto || isExporting} onClick={() => void exportCurrent()} type="button"><Download />{isExporting ? '导出中' : '导出'}</button>
              <button className={`raw-apply-button ${isApplied ? 'is-applied' : ''}`} disabled={!activePhoto} onClick={() => setIsApplied(true)} type="button">{isApplied ? <><Check />已应用</> : <>应用至 {photos.length} 张</>}</button>
            </div>
          </aside>
        </main>
      ) : null}

      {view === 'looks' ? (
        <main className="lab-page lab-library-page">
          <section className="lab-page-intro">
            <div><span className="lab-eyebrow">YOUR COLLECTION</span><h1>我的摄影预设</h1><p>从参考照片学习而来的色彩、光线与胶片质感，可以反复用于任何作品。</p></div>
            <button className="lab-primary-button" onClick={() => setView('create')} type="button"><Plus />创建新预设</button>
          </section>
          <section className="lab-look-grid">
            {looks.map((look, index) => (
              <article className="lab-look-card" key={look.id} style={{ '--card-index': index } as React.CSSProperties}>
                <div className="lab-look-cover">
                  <img alt={`${look.name} 预设封面`} src={look.cover} />
                  <div className="lab-look-actions">
                    <button onClick={() => applyLook(look)} type="button"><Wand2 />应用</button>
                    <button aria-label={`复制 ${look.name}`} onClick={() => duplicateLook(look)} type="button"><Copy /></button>
                    {look.created ? <button aria-label={`删除 ${look.name}`} onClick={() => setLooks((current) => current.filter((item) => item.id !== look.id))} type="button"><Trash2 /></button> : null}
                  </div>
                  <span className="lab-reference-count"><Images /> {look.referenceCount} REFERENCES</span>
                </div>
                <div className="lab-look-meta"><div><h2>{look.name}</h2><p>{look.description}</p></div><button aria-label={`应用 ${look.name}`} onClick={() => applyLook(look)} type="button"><ChevronRight /></button></div>
                <div className="lab-look-tags">{look.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              </article>
            ))}
          </section>
        </main>
      ) : null}

      {view === 'create' ? (
        <main className="lab-page lab-create-page">
          <section className="lab-page-intro lab-create-intro">
            <div><span className="lab-eyebrow">CREATE A LOOK</span><h1>你想要什么样的摄影感觉？</h1><p>放入你喜欢的照片。AI 会学习共同的光线、色彩、镜头与胶片质感。</p></div>
            <span className="lab-step-indicator">STEP 01 · REFERENCES</span>
          </section>
          <div className="lab-create-layout">
            <section className="lab-reference-workspace">
              {references.length === 0 ? (
                <EmptyDropZone title="添加参考照片" description="JPG / PNG / WEBP · 1–12 张" onClick={() => referenceInputRef.current?.click()} onDrop={(files) => void addReferences(files)} />
              ) : (
                <>
                  <div className="lab-reference-grid">
                    {references.map((reference, index) => (
                      <article key={reference.id}><img alt={`参考照片 ${index + 1}: ${reference.name}`} src={reference.src} /><span>{String(index + 1).padStart(2, '0')}</span><button aria-label={`移除参考照片 ${index + 1}`} onClick={() => { setReferences((current) => current.filter((item) => item.id !== reference.id)); setCreatedLook(null); }} type="button"><X /></button></article>
                    ))}
                    {references.length < 12 ? <button className="lab-reference-add" onClick={() => referenceInputRef.current?.click()} type="button"><Plus /><span>继续添加</span></button> : null}
                  </div>
                  {!createdLook ? <button className="lab-analyze-button" disabled={analysisStep >= 0} onClick={() => setAnalysisStep(0)} type="button">{analysisStep >= 0 ? <><span className="lab-analyzing-mark"><Aperture /></span>{ANALYSIS_STEPS[Math.min(analysisStep, ANALYSIS_STEPS.length - 1)]}</> : <><Sparkles />分析摄影风格<span>{references.length} REFERENCES</span></>}</button> : null}
                </>
              )}
            </section>
            <aside className="lab-create-aside">
              {createdLook ? (
                <div className="lab-created-look">
                  <span className="lab-success-mark"><Check /></span><span className="lab-eyebrow">YOUR LOOK</span><img alt={createdLook.name} src={createdLook.cover} /><h2>{createdLook.name}</h2><p>{createdLook.description}</p>
                  <div>{createdLook.tags.map((tag) => <span key={tag}><Check />{tag}</span>)}</div>
                  <button className="lab-primary-button" disabled={presetSaved} onClick={saveCreatedLook} type="button"><Save />{presetSaved ? '已保存到预设库' : '保存预设'}</button>
                  <button className="lab-secondary-button" onClick={() => { saveCreatedLook(); setView('studio'); }} type="button"><ImageIcon />在照片上试用</button>
                </div>
              ) : (
                <div className="lab-reference-guide">
                  <span className="lab-guide-number">01</span><h2>选择同一视觉系列</h2><p>使用 3–8 张风格一致的照片效果最好。不同主体没有关系，关键是摄影语言相近。</p>
                  <ul><li><Check />相似的光线方向</li><li><Check />一致的色彩氛围</li><li><Check />接近的胶片质感</li></ul>
                  <div className="lab-privacy-note"><ShieldCheck /><span><b>仅学习摄影风格</b><small>不会复制人物、服装或画面内容</small></span></div>
                </div>
              )}
            </aside>
          </div>
        </main>
      ) : null}
    </div>
  );
};

export default ModelFactoryApp;
