import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  Aperture, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, ChevronRight,
  CircleHelp, Copy, Download, Eye, Film, Grid3X3, Images, Layers, Lock, Maximize2,
  Menu, MoreHorizontal, MoveHorizontal, Palette, Plus, Redo2, RotateCcw, Save,
  ScanLine, Send, ShieldCheck, SlidersHorizontal, Sparkles, Sun, Trash2, Undo2,
  UploadCloud, Wand2, X, Zap,
} from 'lucide-react';
import './photographyLab.css';

type LabView = 'studio' | 'looks' | 'create' | 'analysis';
type CanvasMode = 'original' | 'matched' | 'reference';
type ApplyMode = 'color' | 'full';
type FineTuneSection = 'ai' | 'color' | 'light' | 'film';
type LabImage = { id: string; name: string; src: string };
type FineTuneState = { exposure: number; contrast: number; warmth: number; saturation: number; grain: number; fade: number; highlights: number; shadows: number };
type FineTuneKey = keyof FineTuneState;
type LookPreset = {
  id: string; name: string; description: string; cover: string; referenceCount: number;
  tags: string[]; filter: string; baseGrain: number; created?: boolean;
  dna: { label: string; value: number }[];
  colors: { name: string; value: string }[];
  bestFor: string[]; lessFor: string[];
};

const LOOK_DNA = [
  { label: '暖调', value: 72 }, { label: '反差', value: 68 }, { label: '饱和', value: 42 },
  { label: '胶片感', value: 74 }, { label: '硬光', value: 81 }, { label: '数字洁净', value: 24 },
];
const LOOK_COLORS = [
  { name: '暖象牙白', value: '#e7ddcc' }, { name: '日晒肤色', value: '#c89572' },
  { name: '灰青蓝', value: '#718487' }, { name: '干燥绿色', value: '#7b8064' }, { name: '深咖黑', value: '#26211e' },
];
type LookInput = Omit<LookPreset, 'dna' | 'colors' | 'bestFor' | 'lessFor' | 'baseGrain'> & Partial<Pick<LookPreset, 'dna' | 'colors' | 'bestFor' | 'lessFor' | 'baseGrain'>>;
const makeLook = ({ dna = LOOK_DNA, colors = LOOK_COLORS, bestFor = ['户外时装', '夏季 Lookbook', '生活方式广告', '自然光人像'], lessFor = ['夜景闪光', '暗调室内', '霓虹光线', '棚拍美妆'], baseGrain = 26, ...look }: LookInput): LookPreset => ({
  ...look, dna, colors, bestFor, lessFor, baseGrain,
});
const BUILT_IN_LOOKS: LookPreset[] = [
  makeLook({ id: 'costa-sun-100', name: 'COSTA SUN 100', description: '奶油高光与深海蓝的地中海暖阳负片', cover: '/look-presets/costa-sun-100.webp', referenceCount: 6, tags: ['强日光', '奶油高光', '晒暖肤色'], filter: 'sepia(.11) saturate(.92) contrast(1.13) brightness(1.035) hue-rotate(-4deg)', baseGrain: 28, dna: [{ label: '暖调', value: 76 }, { label: '反差', value: 72 }, { label: '饱和', value: 48 }, { label: '胶片感', value: 82 }, { label: '硬光', value: 88 }, { label: '数字洁净', value: 16 }], colors: [{ name: '奶油白', value: '#e8dfcf' }, { name: '晒暖肤色', value: '#bc815f' }, { name: '深海蓝', value: '#24566f' }, { name: '干燥石灰', value: '#a99b82' }, { name: '咖啡黑', value: '#2c211d' }], bestFor: ['海岸时装', '度假 Lookbook', '强日光人像', '夏季广告'], lessFor: ['夜景闪光', '阴天柔光', '霓虹光线', '纯白棚拍'] }),
  makeLook({ id: 'azure-negative-200', name: 'AZURE NEGATIVE 200', description: '褪色青蓝海岸与开放冷阴影', cover: '/look-presets/azure-negative-200.webp', referenceCount: 5, tags: ['青蓝负片', '低饱和', '开放阴影'], filter: 'sepia(.045) saturate(.78) contrast(1.07) brightness(1.035) hue-rotate(-6deg)', baseGrain: 34, dna: [{ label: '暖调', value: 42 }, { label: '反差', value: 58 }, { label: '饱和', value: 36 }, { label: '胶片感', value: 88 }, { label: '硬光', value: 68 }, { label: '数字洁净', value: 12 }], colors: [{ name: '粉雾蓝', value: '#9db9c5' }, { name: '海湾青', value: '#377d89' }, { name: '暖肤色', value: '#b98265' }, { name: '粉笔白', value: '#ded8ca' }, { name: '巧克力', value: '#32231f' }], bestFor: ['海边全身', '环境人像', '城市海岸', '复古画报'], lessFor: ['夜景', '高饱和产品', '绿色森林', '冷白棚拍'] }),
  makeLook({ id: 'blanca-sun-160', name: 'BLANCA SUN 160', description: '白墙硬光、干燥黑位与亚麻质感', cover: '/look-presets/blanca-sun-160.webp', referenceCount: 6, tags: ['白墙硬光', '干燥黑位', '亚麻白'], filter: 'sepia(.085) saturate(.72) contrast(1.19) brightness(1.055) hue-rotate(-2deg)', baseGrain: 24, dna: [{ label: '暖调', value: 64 }, { label: '反差', value: 84 }, { label: '饱和', value: 28 }, { label: '胶片感', value: 72 }, { label: '硬光', value: 94 }, { label: '数字洁净', value: 22 }], colors: [{ name: '粉笔白', value: '#e4ded3' }, { name: '亚麻米', value: '#c8b9a2' }, { name: '晒后肤色', value: '#ae7657' }, { name: '褪色黑', value: '#292a27' }, { name: '阴影灰', value: '#6e706a' }], bestFor: ['建筑人像', '亚麻服饰', '极简时装', '正午硬光'], lessFor: ['低照度室内', '夜景', '柔雾人像', '高饱和商品'] }),
  makeLook({ id: 'roja-heat-400', name: 'ROJA HEAT 400', description: '高温朱红、钴蓝与浓郁夏日颗粒', cover: '/look-presets/roja-heat-400.webp', referenceCount: 5, tags: ['朱红高温', '钴蓝', '浓颗粒'], filter: 'sepia(.13) saturate(1.08) contrast(1.15) brightness(.995) hue-rotate(-4deg)', baseGrain: 38, dna: [{ label: '暖调', value: 86 }, { label: '反差', value: 78 }, { label: '饱和', value: 68 }, { label: '胶片感', value: 92 }, { label: '硬光', value: 86 }, { label: '数字洁净', value: 8 }], colors: [{ name: '朱砂红', value: '#b84530' }, { name: '褪色珊瑚', value: '#d0785d' }, { name: '钴蓝', value: '#264f78' }, { name: '海水青', value: '#477f89' }, { name: '暖粉笔白', value: '#ddd2bf' }], bestFor: ['印花长裙', '度假广告', '强色时装', '海岸建筑'], lessFor: ['冷调美妆', '儿童摄影', '阴天街拍', '极简电商白底'] }),
];
const ANALYSIS_STEPS = ['正在读取光线方向与光比…', '正在寻找共同色彩响应…', '正在分离人物与摄影风格…', '正在分析高光和阴影…', '正在识别胶片与镜头质感…', '正在建立 LOOK…'];
const MATCH_STEPS = ['分析原始光线…', '保护人物与服装结构…', '重建综合色彩响应…', '匹配胶片质感…', '锁定整组一致性…'];
const DEFAULT_FINE_TUNE: FineTuneState = { exposure: 0, contrast: 8, warmth: 6, saturation: 0, grain: 18, fade: 4, highlights: -12, shadows: 8 };
type EditorSnapshot = { fineTune: FineTuneState; strength: number; applyMode: ApplyMode; contentLock: boolean; collectionLock: boolean };
type EditorHistory = { past: EditorSnapshot[]; present: EditorSnapshot; future: EditorSnapshot[] };
type EditorAction = { type: 'patch'; patch: Partial<EditorSnapshot> } | { type: 'undo' | 'redo' | 'reset' };
const DEFAULT_EDITOR: EditorSnapshot = { fineTune: DEFAULT_FINE_TUNE, strength: 82, applyMode: 'full', contentLock: true, collectionLock: true };
const editorReducer = (state: EditorHistory, action: EditorAction): EditorHistory => {
  if (action.type === 'undo') {
    const previous = state.past.at(-1);
    return previous ? { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future] } : state;
  }
  if (action.type === 'redo') {
    const next = state.future[0];
    return next ? { past: [...state.past, state.present], present: next, future: state.future.slice(1) } : state;
  }
  if (action.type === 'reset') return { past: [...state.past, state.present].slice(-60), present: DEFAULT_EDITOR, future: [] };
  const next = { ...state.present, ...action.patch };
  if (JSON.stringify(next) === JSON.stringify(state.present)) return state;
  return { past: [...state.past, state.present].slice(-60), present: next, future: [] };
};
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const getInitialLooks = (): LookPreset[] => {
  try {
    const saved = JSON.parse(localStorage.getItem('xcai-look-presets') ?? '[]') as LookPreset[];
    return [...saved.filter((look) => look?.id && look?.name).map((look) => makeLook({ ...look, cover: look.cover || '/official_model_anna.jpg' })), ...BUILT_IN_LOOKS];
  } catch { return BUILT_IN_LOOKS; }
};
const readImages = async (files: File[], limit: number): Promise<LabImage[]> => Promise.all(
  files.filter((file) => file.type.startsWith('image/')).slice(0, limit).map((file) => new Promise<LabImage>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ id: makeId(), name: file.name, src: String(reader.result) });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  })),
);
const drawFilmGrain = (context: CanvasRenderingContext2D, width: number, height: number, amount: number) => {
  const grain = document.createElement('canvas');
  const scale = Math.min(1, 640 / Math.max(width, height));
  grain.width = Math.max(1, Math.round(width * scale));
  grain.height = Math.max(1, Math.round(height * scale));
  const grainContext = grain.getContext('2d');
  if (!grainContext) return;
  const imageData = grainContext.createImageData(grain.width, grain.height);
  for (let index = 0; index < imageData.data.length; index += 4) {
    const shade = Math.round(92 + Math.random() * 72);
    imageData.data[index] = shade;
    imageData.data[index + 1] = shade;
    imageData.data[index + 2] = shade;
    imageData.data[index + 3] = 112;
  }
  grainContext.putImageData(imageData, 0, 0);
  context.save();
  context.globalAlpha = Math.min(.18, amount / 420);
  context.globalCompositeOperation = 'soft-light';
  context.imageSmoothingEnabled = false;
  context.drawImage(grain, 0, 0, width, height);
  context.restore();
};

const Toggle: React.FC<{ checked: boolean; label: string; onChange: () => void }> = ({ checked, label, onChange }) => (
  <button aria-label={label} aria-pressed={checked} className={`look-toggle ${checked ? 'is-on' : ''}`} onClick={onChange} type="button"><span /></button>
);
const FineSlider: React.FC<{ label: string; value: number; min?: number; max?: number; onChange: (value: number) => void }> = ({ label, value, min = -100, max = 100, onChange }) => (
  <label className="look-fine-slider"><span>{label}</span><input max={max} min={min} onChange={(event) => onChange(Number(event.target.value))} type="range" value={value} /><output>{value > 0 ? '+' : ''}{value}</output></label>
);
const Metric: React.FC<{ label: string; value: number; warn?: boolean }> = ({ label, value, warn }) => (
  <div className="look-metric"><span>{label}</span><i><b className={warn ? 'is-warn' : ''} style={{ width: `${value}%` }} /></i><output>{value}%</output></div>
);
const EmptyDropZone: React.FC<{ title: string; description: string; onClick: () => void; onDrop: (files: File[]) => void }> = ({ title, description, onClick, onDrop }) => {
  const [dragging, setDragging] = useState(false);
  return <button className={`look-drop-zone ${dragging ? 'is-dragging' : ''}`} onClick={onClick} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={(event) => { event.preventDefault(); setDragging(false); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); setDragging(false); onDrop(Array.from(event.dataTransfer.files)); }} type="button"><span><UploadCloud /></span><strong>{title}</strong><small>{description}</small></button>;
};
const ReferenceMosaic: React.FC<{ sources: string[]; label?: string }> = ({ sources, label }) => {
  const fallback = ['/look-presets/costa-sun-100.webp', '/look-presets/azure-negative-200.webp', '/look-presets/blanca-sun-160.webp', '/look-presets/roja-heat-400.webp'];
  const items = [...sources, ...fallback].slice(0, 5);
  return <div className="look-reference-mosaic">{items.map((source, index) => <img alt={`参考照片 ${index + 1}`} key={`${source}-${index}`} src={source} />)}{label ? <span>{label}</span> : null}</div>;
};

const ModelFactoryApp: React.FC = () => {
  const [view, setView] = useState<LabView>('studio');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [looks, setLooks] = useState<LookPreset[]>(getInitialLooks);
  const [selectedLookId, setSelectedLookId] = useState(BUILT_IN_LOOKS[0].id);
  const [photos, setPhotos] = useState<LabImage[]>([]);
  const [activePhotoId, setActivePhotoId] = useState('');
  const [references, setReferences] = useState<LabImage[]>([]);
  const [createdLook, setCreatedLook] = useState<LookPreset | null>(null);
  const [analysisStep, setAnalysisStep] = useState(-1);
  const [lookSaved, setLookSaved] = useState(false);
  const [canvasMode, setCanvasMode] = useState<CanvasMode>('matched');
  const [editorHistory, dispatchEditor] = useReducer(editorReducer, { past: [], present: DEFAULT_EDITOR, future: [] });
  const { applyMode, collectionLock, contentLock, fineTune, strength } = editorHistory.present;
  const [comparison, setComparison] = useState(58);
  const [zoom, setZoom] = useState(100);
  const [gridVisible, setGridVisible] = useState(false);
  const [fineTuneOpen, setFineTuneOpen] = useState(false);
  const [fineTuneSection, setFineTuneSection] = useState<FineTuneSection>('ai');
  const [matchStep, setMatchStep] = useState(-1);
  const [appliedPhotoIds, setAppliedPhotoIds] = useState<string[]>([]);
  const [referencePeek, setReferencePeek] = useState(false);
  const [intent, setIntent] = useState('');
  const [openLookMenu, setOpenLookMenu] = useState<string | null>(null);
  const [panelMenuOpen, setPanelMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const targetInputRef = useRef<HTMLInputElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const comparisonFrameRef = useRef<HTMLDivElement>(null);
  const fineTuneRef = useRef<HTMLElement>(null);

  const selectedLook = useMemo(() => looks.find((look) => look.id === selectedLookId) ?? looks[0], [looks, selectedLookId]);
  const activePhoto = useMemo(() => photos.find((photo) => photo.id === activePhotoId) ?? photos[0], [activePhotoId, photos]);
  const isApplied = Boolean(activePhoto && appliedPhotoIds.includes(activePhoto.id));
  const analysisLook = createdLook ?? selectedLook;
  const referenceSources = useMemo(() => references.length ? references.map((item) => item.src) : [selectedLook.cover], [references, selectedLook.cover]);
  const match = useMemo(() => { const offset = Math.max(0, photos.findIndex((photo) => photo.id === activePhotoId)) * 3; return { overall: 82 - offset, color: 91 - offset, light: 54 + offset, skin: 87 - offset, exposure: 79 - offset }; }, [activePhotoId, photos]);
  const editedFilter = useMemo(() => {
    const lightFactor = applyMode === 'full' ? 1 : 0;
    const brightness = Math.max(.6, 1 + ((fineTune.exposure + fineTune.shadows * .12 + fineTune.highlights * .06) * lightFactor) / 100);
    const contrast = Math.max(.55, 1 + ((fineTune.contrast - fineTune.fade * .35) * lightFactor) / 100);
    const saturation = Math.max(.2, 1 + fineTune.saturation / 100);
    const warmth = Math.max(0, fineTune.warmth) / 420;
    const preserveLight = applyMode === 'color' ? ' contrast(.94) brightness(.995)' : '';
    return `${selectedLook.filter}${preserveLight} brightness(${brightness}) contrast(${contrast}) saturate(${saturation}) sepia(${warmth})`;
  }, [applyMode, fineTune, selectedLook.filter]);

  const notify = useCallback((message: string) => setToast(message), []);
  const patchEditor = useCallback((patch: Partial<EditorSnapshot>) => dispatchEditor({ type: 'patch', patch }), []);
  const updateFineTune = useCallback((key: FineTuneKey, value: number) => {
    dispatchEditor({ type: 'patch', patch: { fineTune: { ...editorHistory.present.fineTune, [key]: value } } });
  }, [editorHistory.present.fineTune]);
  const openFineTune = useCallback((section: FineTuneSection) => {
    setFineTuneSection(section);
    setFineTuneOpen(section !== 'ai');
    window.requestAnimationFrame(() => fineTuneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, []);
  const addTargetPhotos = useCallback(async (files: File[]) => {
    const available = Math.max(0, 20 - photos.length);
    if (!available) { notify('最多只能添加 20 张照片'); return; }
    const next = await readImages(files, available);
    if (!next.length) { notify('请选择 JPG、PNG 或 WEBP 图片'); return; }
    setPhotos((current) => [...current, ...next]);
    setActivePhotoId(next[0].id);
    setMatchStep(-1);
    notify(`已添加 ${next.length} 张照片`);
  }, [notify, photos.length]);
  const addReferences = useCallback(async (files: File[]) => { const next = await readImages(files, Math.max(0, 12 - references.length)); if (!next.length) return; setReferences((current) => [...current, ...next]); setCreatedLook(null); setLookSaved(false); }, [references.length]);
  const removePhoto = useCallback((id: string) => {
    setPhotos((current) => {
      const index = current.findIndex((photo) => photo.id === id);
      const next = current.filter((photo) => photo.id !== id);
      if (activePhotoId === id) setActivePhotoId(next[Math.min(Math.max(index, 0), Math.max(0, next.length - 1))]?.id ?? '');
      return next;
    });
    setAppliedPhotoIds((current) => current.filter((photoId) => photoId !== id));
    notify('照片已移除');
  }, [activePhotoId, notify]);

  useEffect(() => { const saved = looks.filter((look) => look.created).map((look) => ({ ...look, cover: look.cover.startsWith('data:') ? '/official_model_anna.jpg' : look.cover })); localStorage.setItem('xcai-look-presets', JSON.stringify(saved)); }, [looks]);
  useEffect(() => {
    if (analysisStep < 0) return;
    if (analysisStep < ANALYSIS_STEPS.length - 1) { const timer = window.setTimeout(() => setAnalysisStep((current) => current + 1), 760); return () => window.clearTimeout(timer); }
    const timer = window.setTimeout(() => { const look = makeLook({ id: `custom-${makeId()}`, name: ['RIVIERA 250', 'SIENA 320', 'MONO 640'][looks.length % 3], description: '暖调自然光画报', cover: references[0]?.src ?? '/official_model_anna.jpg', referenceCount: references.length, tags: ['方向性暖光', '柔和高光', '细颗粒'], filter: 'sepia(.14) saturate(.93) contrast(1.07) brightness(1.03) hue-rotate(-3deg)', created: true }); setCreatedLook(look); setSelectedLookId(look.id); setAnalysisStep(-1); setView('analysis'); }, 760);
    return () => window.clearTimeout(timer);
  }, [analysisStep, looks.length, references]);
  useEffect(() => {
    if (matchStep < 0) return;
    if (matchStep < MATCH_STEPS.length - 1) { const timer = window.setTimeout(() => setMatchStep((current) => current + 1), 620); return () => window.clearTimeout(timer); }
    const timer = window.setTimeout(() => {
      const targets = collectionLock && photos.length > 1 ? photos.map((photo) => photo.id) : activePhoto ? [activePhoto.id] : [];
      setAppliedPhotoIds((current) => Array.from(new Set([...current, ...targets])));
      setMatchStep(-1);
      setCanvasMode('matched');
      notify(collectionLock && targets.length > 1 ? `LOOK 已应用至 ${targets.length} 张照片` : 'LOOK 已应用');
    }, 620); return () => window.clearTimeout(timer);
  }, [activePhoto, collectionLock, matchStep, notify, photos]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches('input,textarea,[contenteditable="true"]')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        dispatchEditor({ type: event.shiftKey ? 'redo' : 'undo' });
      } else if (view === 'studio' && event.key.toLowerCase() === 'g') {
        setGridVisible((current) => !current);
      } else if (view === 'studio' && event.key === '0') {
        setZoom(100);
        notify('画布已适配');
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [notify, view]);

  const saveLook = useCallback(() => { if (!analysisLook || lookSaved) return; if (!looks.some((look) => look.id === analysisLook.id)) setLooks((current) => [analysisLook, ...current]); setSelectedLookId(analysisLook.id); setLookSaved(true); notify('LOOK 已保存到资产库'); }, [analysisLook, lookSaved, looks, notify]);
  const tryLook = useCallback((look: LookPreset) => { if (!looks.some((item) => item.id === look.id)) setLooks((current) => [look, ...current]); setSelectedLookId(look.id); setView('studio'); setAppliedPhotoIds([]); notify(`已选择 ${look.name}`); }, [looks, notify]);
  const applyLook = useCallback((look: LookPreset) => { setSelectedLookId(look.id); setView('studio'); setAppliedPhotoIds([]); setMobileNavOpen(false); notify(`已选择 ${look.name}`); }, [notify]);
  const updateComparisonFromPointer = useCallback((clientX: number) => { const frame = comparisonFrameRef.current; if (!frame) return; const bounds = frame.getBoundingClientRect(); setComparison(Math.round(Math.min(100, Math.max(0, ((clientX - bounds.left) / bounds.width) * 100)))); }, []);
  const handleComparisonKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => { const step = event.shiftKey ? 10 : 1; if (event.key === 'ArrowLeft') { event.preventDefault(); setComparison((current) => Math.max(0, current - step)); } if (event.key === 'ArrowRight') { event.preventDefault(); setComparison((current) => Math.min(100, current + step)); } if (event.key === 'Home') { event.preventDefault(); setComparison(0); } if (event.key === 'End') { event.preventDefault(); setComparison(100); } }, []);
  const downloadPhoto = useCallback(async (photo: LabImage) => {
    const image = new window.Image(); image.src = photo.src; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d'); if (!context) return;
    context.filter = editedFilter; context.drawImage(image, 0, 0); context.filter = 'none';
    drawFilmGrain(context, canvas.width, canvas.height, selectedLook.baseGrain + fineTune.grain);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', .94)); if (!blob) return;
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url;
    anchor.download = `${selectedLook.name.toLowerCase().replace(/\s+/g, '-')}-${photo.name}.jpg`; anchor.click(); URL.revokeObjectURL(url);
  }, [editedFilter, fineTune.grain, selectedLook.baseGrain, selectedLook.name]);
  const exportCurrent = async () => {
    if (!activePhoto) { notify('请先添加照片'); return; } setIsExporting(true);
    try { await downloadPhoto(activePhoto); notify('当前照片已导出'); } catch { notify('导出失败，请重新尝试'); } finally { setIsExporting(false); }
  };
  const exportAll = async () => {
    if (!photos.length) { notify('请先添加照片'); return; } setIsExporting(true);
    try { for (const photo of photos) await downloadPhoto(photo); notify(`已导出 ${photos.length} 张照片`); } catch { notify('批量导出未完成，请重新尝试'); } finally { setIsExporting(false); setPanelMenuOpen(false); }
  };
  const resetEditor = () => {
    dispatchEditor({ type: 'reset' }); setComparison(50); setZoom(100); setGridVisible(false); setCanvasMode('matched'); setAppliedPhotoIds([]); notify('所有调整已复位');
  };
  const submitIntent = () => {
    const text = intent.trim(); if (!text) return;
    const next = { ...fineTune }; let nextStrength = strength; let nextMode = applyMode;
    if (text.includes('亮')) next.exposure = Math.min(100, next.exposure + 10);
    if (text.includes('暗')) next.exposure = Math.max(-100, next.exposure - 10);
    if (text.includes('对比')) next.contrast = Math.min(100, next.contrast + (text.includes('少') || text.includes('低') ? -10 : 10));
    if (text.includes('饱和')) next.saturation = Math.max(-100, Math.min(100, next.saturation + (text.includes('少') || text.includes('低') ? -10 : 10)));
    if (text.includes('肤色') || text.includes('黄')) next.warmth = Math.max(-100, next.warmth - 10);
    else if (text.includes('暖')) next.warmth = Math.min(100, next.warmth + 10);
    if (text.includes('冷')) next.warmth = Math.max(-100, next.warmth - 10);
    if (text.includes('颗粒')) next.grain = Math.max(0, Math.min(100, next.grain + (text.includes('少') ? -8 : 8)));
    if (text.includes('褪色')) next.fade = Math.max(0, Math.min(100, next.fade + (text.includes('少') ? -8 : 8)));
    if (text.includes('参考') || text.includes('更像')) nextStrength = Math.min(100, strength + 8);
    if (text.includes('光线')) { nextMode = 'full'; next.contrast = Math.min(100, next.contrast + 8); next.highlights = Math.min(100, next.highlights + 8); }
    patchEditor({ fineTune: next, strength: nextStrength, applyMode: nextMode });
    if (activePhoto) setAppliedPhotoIds((current) => Array.from(new Set([...current, activePhoto.id])));
    setIntent(''); notify('AI 已完成自然语言微调');
  };
  const adoptRecommendation = () => { patchEditor({ applyMode: 'full', fineTune: { ...fineTune, contrast: Math.max(12, fineTune.contrast), highlights: Math.min(fineTune.highlights, -16), shadows: Math.max(fineTune.shadows, 12) } }); notify('已采用 AI 建议'); };
  const copySettings = async () => {
    const payload = JSON.stringify({ look: selectedLook.name, ...editorHistory.present }, null, 2);
    try { await navigator.clipboard.writeText(payload); notify('当前 LOOK 参数已复制'); } catch { notify('浏览器未允许复制，请使用 HTTPS 访问'); }
    setPanelMenuOpen(false);
  };
  const assetView = view !== 'studio';

  return <div className={`photography-lab look-app ${assetView ? 'is-asset-view' : ''}`}>
    <input ref={targetInputRef} accept="image/jpeg,image/png,image/webp" aria-label="上传待处理照片" className="sr-only" multiple onChange={(event) => { void addTargetPhotos(Array.from(event.target.files ?? [])); event.target.value = ''; }} type="file" />
    <input ref={referenceInputRef} accept="image/jpeg,image/png,image/webp" aria-label="上传参考照片" className="sr-only" multiple onChange={(event) => { void addReferences(Array.from(event.target.files ?? [])); event.target.value = ''; }} type="file" />

    <header className="look-header">
      <div className="look-brand-wrap"><button aria-label="返回 XcAI Studio" className="look-back" onClick={() => { window.location.href = '/'; }} type="button"><ArrowLeft /></button><button className="look-brand" onClick={() => setView('studio')} type="button"><Aperture /><span><b>AI LOOK</b><small>摄影实验室</small></span></button></div>
      <nav className={mobileNavOpen ? 'is-open' : ''}><button className={view === 'studio' ? 'is-active' : ''} onClick={() => setView('studio')} type="button">工作台</button><button className={view === 'looks' ? 'is-active' : ''} onClick={() => setView('looks')} type="button">LOOKS</button><button className={view === 'create' ? 'is-active' : ''} onClick={() => setView('create')} type="button"><Plus />创建 LOOK</button></nav>
      <div className="look-header-actions"><button className="look-help" onClick={() => setHelpOpen(true)} type="button"><CircleHelp />使用指南</button><button aria-label="打开导航" className="look-menu" onClick={() => setMobileNavOpen((current) => !current)} type="button">{mobileNavOpen ? <X /> : <Menu />}</button></div>
    </header>

    {view === 'studio' ? <main className="look-studio">
      <aside className="look-tool-rail" aria-label="工作台工具"><button aria-label="AI LOOK" className={fineTuneSection === 'ai' ? 'is-active' : ''} onClick={() => openFineTune('ai')} type="button"><Aperture /></button><button aria-label="添加照片" onClick={() => targetInputRef.current?.click()} type="button"><Plus /></button><span /><button aria-label="撤销" disabled={!editorHistory.past.length} onClick={() => dispatchEditor({ type: 'undo' })} type="button"><Undo2 /></button><button aria-label="重做" disabled={!editorHistory.future.length} onClick={() => dispatchEditor({ type: 'redo' })} type="button"><Redo2 /></button><button aria-label={canvasMode === 'original' ? '返回匹配结果' : '查看原图'} className={canvasMode === 'original' ? 'is-active' : ''} disabled={!activePhoto} onClick={() => setCanvasMode((current) => current === 'original' ? 'matched' : 'original')} type="button"><Eye /></button><button aria-label="查看参考" className={referencePeek ? 'is-active' : ''} onClick={() => setReferencePeek((current) => !current)} type="button"><Images /></button><i /><button aria-label="适合画布" disabled={!activePhoto} onClick={() => { setZoom(100); notify('画布已适配'); }} type="button"><Maximize2 /></button><label className="look-rail-zoom"><input aria-label="画布缩放" max="180" min="50" onChange={(event) => setZoom(Number(event.target.value))} orient="vertical" type="range" value={zoom} /><output>{zoom}%</output></label><button aria-label="网格" aria-pressed={gridVisible} className={gridVisible ? 'is-active' : ''} onClick={() => setGridVisible((current) => !current)} type="button"><Grid3X3 /></button></aside>
      <aside className="look-filmstrip"><div><span>照片</span><b>{photos.length} / 20</b></div><div className="look-film-list">{photos.map((photo, index) => <article className={`${photo.id === activePhotoId ? 'is-active' : ''} ${appliedPhotoIds.includes(photo.id) ? 'is-applied' : ''}`} key={photo.id}><button aria-label={`选择 ${photo.name}`} onClick={() => setActivePhotoId(photo.id)} type="button"><img alt={photo.name} src={photo.src} /><span>{String(index + 1).padStart(2, '0')}</span>{appliedPhotoIds.includes(photo.id) ? <i><Check /></i> : null}</button><button aria-label={`移除 ${photo.name}`} className="look-remove-photo" onClick={() => removePhoto(photo.id)} type="button"><X /></button></article>)}<button className="look-add-photo" onClick={() => targetInputRef.current?.click()} type="button"><Plus /><span>添加</span></button></div></aside>
      <section className="look-canvas-workspace">
        <div className="look-canvas-toolbar"><button className={referencePeek ? 'is-active' : ''} onClick={() => setReferencePeek((current) => !current)} type="button"><Images />参考照片</button><div role="tablist" aria-label="画布显示模式"><button className={canvasMode === 'original' ? 'is-active' : ''} onClick={() => setCanvasMode('original')} role="tab" type="button">原图</button><button className={canvasMode === 'matched' ? 'is-active' : ''} onClick={() => setCanvasMode('matched')} role="tab" type="button">匹配结果</button><button className={canvasMode === 'reference' ? 'is-active' : ''} onClick={() => setCanvasMode('reference')} role="tab" type="button">参考</button></div><span>{activePhoto?.name}</span></div>
        <div className={`look-canvas-stage ${gridVisible ? 'is-grid-visible' : ''}`}>{activePhoto ? canvasMode === 'reference' ? <div className="look-zoom-surface" style={{ transform: `scale(${zoom / 100})` }}><ReferenceMosaic label={`${selectedLook.name} · 参考组`} sources={referenceSources} /></div> : <div className="look-compare-frame" ref={comparisonFrameRef} style={{ transform: `scale(${zoom / 100})` }}><img alt={`${activePhoto.name} 原图`} src={activePhoto.src} />{canvasMode === 'matched' ? <><div className="look-matched-layer" style={{ clipPath: `inset(0 ${100 - comparison}% 0 0)`, opacity: strength / 100, '--look-grain': Math.min(.2, (selectedLook.baseGrain + fineTune.grain) / 360), '--look-fade': Math.min(.22, fineTune.fade / 240), '--look-shadow': Math.max(0, Math.min(.16, fineTune.shadows / 420)), '--look-highlight': Math.max(0, Math.min(.16, fineTune.highlights / 420)) } as React.CSSProperties}><img alt={`${activePhoto.name} 匹配结果`} src={activePhoto.src} style={{ filter: editedFilter }} /><span className="look-tone-finish" /><span className="look-film-grain" /></div><div aria-label="拖动调整前后对比位置" aria-orientation="horizontal" aria-valuemax={100} aria-valuemin={0} aria-valuenow={comparison} className="look-compare-line" onKeyDown={handleComparisonKeyDown} onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); updateComparisonFromPointer(event.clientX); }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) updateComparisonFromPointer(event.clientX); }} onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} role="slider" style={{ left: `${comparison}%` }} tabIndex={0}><span><MoveHorizontal /></span></div></> : null}<span className="look-canvas-label is-left">原图</span><span className="look-canvas-label is-right">{canvasMode === 'matched' ? selectedLook.name : '原图'}</span></div> : <EmptyDropZone description="JPG / PNG / WEBP · 最多 20 张" onClick={() => targetInputRef.current?.click()} onDrop={(files) => void addTargetPhotos(files)} title="添加需要匹配的照片" />}{referencePeek ? <aside className="look-reference-peek"><div><span>参考照片</span><button aria-label="关闭参考照片" onClick={() => setReferencePeek(false)} type="button"><X /></button></div><ReferenceMosaic sources={referenceSources} /><small>{selectedLook.name} · {selectedLook.referenceCount} 张参考</small></aside> : null}{matchStep >= 0 ? <div className="look-matching-overlay"><Aperture /><span>正在匹配 {selectedLook.name}</span><strong>{MATCH_STEPS[matchStep]}</strong><small>照片 {Math.max(1, photos.findIndex((photo) => photo.id === activePhotoId) + 1)} / {photos.length}</small></div> : null}</div>
        {canvasMode === 'matched' && activePhoto ? <div className="look-bottom-compare"><span>原图</span><input aria-label="前后对比位置" max="100" min="0" onChange={(event) => setComparison(Number(event.target.value))} type="range" value={comparison} /><span>匹配结果</span></div> : null}
      </section>
      <aside className="look-ai-panel"><div className="look-ai-panel-title"><span>AI LOOK</span><button aria-expanded={panelMenuOpen} aria-label="更多选项" onClick={() => setPanelMenuOpen((current) => !current)} type="button"><MoreHorizontal /></button>{panelMenuOpen ? <div className="look-panel-menu"><button onClick={() => void copySettings()} type="button"><Copy />复制当前参数</button><button disabled={!photos.length || isExporting} onClick={() => void exportAll()} type="button"><Download />导出全部照片</button><button disabled={!activePhoto} onClick={() => { if (activePhoto) removePhoto(activePhoto.id); setPanelMenuOpen(false); }} type="button"><Trash2 />移除当前照片</button><button onClick={() => { resetEditor(); setPanelMenuOpen(false); }} type="button"><RotateCcw />复位所有调整</button></div> : null}</div><div className="look-ai-scroll">
        <section className="look-panel-section look-current-look"><header><span>当前 LOOK</span><button onClick={() => setView('looks')} type="button">更换 <ChevronRight /></button></header><div><img alt={selectedLook.name} src={selectedLook.cover} /><span><b>{selectedLook.name}</b><small>{selectedLook.description}</small><em>{selectedLook.referenceCount} 张参考照片</em></span></div></section>
        <section className="look-panel-section look-ai-match"><header><span>AI 匹配</span><b>{match.overall}%</b></header><div className="look-score-ring" style={{ '--score': `${match.overall * 3.6}deg` } as React.CSSProperties}><strong>{match.overall}</strong><small>适配度</small></div><div className="look-metrics"><Metric label="色彩" value={match.color} /><Metric label="光线" value={match.light} warn /><Metric label="肤色" value={match.skin} /><Metric label="曝光" value={match.exposure} /></div><p>当前照片与 {selectedLook.name} 的色彩接近，但原始光线偏柔，差异较明显。</p></section>
        <section className="look-panel-section look-recommendation"><header><span>AI 建议</span><em>推荐完整匹配</em></header><ul><li><Check />迁移综合色彩</li><li><Check />匹配高光与阴影</li><li><Check />应用胶片质感</li></ul><p><Zap />参考 LOOK 是强方向性日光，建议重建局部光影。</p><button className="look-adopt-recommendation" onClick={adoptRecommendation} type="button">采用 AI 建议</button></section>
        <section className="look-panel-section look-apply-mode"><header><span>迁移模式</span></header><button className={applyMode === 'color' ? 'is-active' : ''} onClick={() => { patchEditor({ applyMode: 'color' }); notify('已切换为色彩匹配'); }} type="button"><i /><span><b>色彩匹配</b><small>迁移色调、综合色彩和胶片质感<br />保留原始光线结构</small></span></button><button className={applyMode === 'full' ? 'is-active' : ''} onClick={() => { patchEditor({ applyMode: 'full' }); notify('已切换为完整摄影匹配'); }} type="button"><i /><span><b>完整摄影匹配</b><small>迁移色彩、光线、高光阴影和摄影氛围</small></span><em>推荐</em></button></section>
        <section className="look-locks"><div><span><Lock /><b>内容保护</b><small>人物、服装、图案、Logo 与场景结构</small></span><Toggle checked={contentLock} label="内容保护" onChange={() => { patchEditor({ contentLock: !contentLock }); notify(contentLock ? '内容保护已关闭' : '内容保护已开启'); }} /></div>{photos.length > 1 ? <div><span><Layers /><b>整组一致</b><small>{photos.length} 张照片共享肤色、白平衡、黑位和颗粒</small></span><Toggle checked={collectionLock} label="整组一致" onChange={() => { patchEditor({ collectionLock: !collectionLock }); notify(collectionLock ? '将只处理当前照片' : `将同步处理 ${photos.length} 张照片`); }} /></div> : null}</section>
        {isApplied ? <section className="look-panel-section look-applied"><header><span><CheckCircle2 />LOOK 已应用</span><b>89%</b></header><strong>{selectedLook.name}</strong><small>AI 已完成</small><ul><li><Check />暖化高光并保护肤色</li><li><Check />重建灰青蓝阴影</li><li><Check />柔化数字锐度</li><li><Check />加入细胶片颗粒</li>{applyMode === 'full' ? <li><Check />重建左上方自然日光</li> : null}</ul></section> : null}
        <section className="look-panel-section look-strength"><header><span>LOOK 强度</span><output>{strength}</output></header><input max="100" min="0" onChange={(event) => patchEditor({ strength: Number(event.target.value) })} type="range" value={strength} /></section>
        {isApplied ? <section className="look-panel-section look-quick-intent"><header><span>快速调整</span></header><div><button onClick={() => patchEditor({ strength: Math.min(100, strength + 8) })} type="button">更像参考</button><button onClick={() => updateFineTune('grain', Math.max(0, fineTune.grain - 8))} type="button">少一点胶片感</button><button onClick={() => updateFineTune('warmth', fineTune.warmth - 8)} type="button">肤色自然一点</button><button onClick={() => patchEditor({ applyMode: 'full', fineTune: { ...fineTune, contrast: Math.min(100, fineTune.contrast + 8), highlights: Math.min(100, fineTune.highlights + 10) } })} type="button">光线更强</button></div><label><input aria-label="自然语言微调" onChange={(event) => setIntent(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submitIntent(); }} placeholder="例如：肤色冷一点、少一点颗粒…" value={intent} /><button aria-label="提交调整" onClick={submitIntent} type="button"><Send /></button></label></section> : null}
        <section className={`look-panel-section look-fine-tune ${fineTuneOpen ? 'is-open' : ''}`} ref={fineTuneRef}><button aria-expanded={fineTuneOpen} onClick={() => setFineTuneOpen((current) => !current)} type="button"><span><SlidersHorizontal />{fineTuneSection === 'ai' ? '全部微调' : fineTuneSection === 'color' ? '色彩微调' : fineTuneSection === 'light' ? '光线微调' : '胶片微调'}</span><ChevronDown /></button>{fineTuneOpen ? <div>{fineTuneSection === 'ai' || fineTuneSection === 'light' ? <><span>光线</span><FineSlider label="曝光" value={fineTune.exposure} onChange={(value) => updateFineTune('exposure', value)} /><FineSlider label="对比度" value={fineTune.contrast} onChange={(value) => updateFineTune('contrast', value)} /><FineSlider label="高光" value={fineTune.highlights} onChange={(value) => updateFineTune('highlights', value)} /><FineSlider label="阴影" value={fineTune.shadows} onChange={(value) => updateFineTune('shadows', value)} /></> : null}{fineTuneSection === 'ai' || fineTuneSection === 'color' ? <><span>色彩</span><FineSlider label="暖调" value={fineTune.warmth} onChange={(value) => updateFineTune('warmth', value)} /><FineSlider label="饱和度" value={fineTune.saturation} onChange={(value) => updateFineTune('saturation', value)} /></> : null}{fineTuneSection === 'ai' || fineTuneSection === 'film' ? <><span>胶片</span><FineSlider label="颗粒" min={0} value={fineTune.grain} onChange={(value) => updateFineTune('grain', value)} /><FineSlider label="褪色" min={0} value={fineTune.fade} onChange={(value) => updateFineTune('fade', value)} /></> : null}</div> : null}</section>
      </div><div className="look-panel-footer"><button aria-label="复位" onClick={resetEditor} type="button"><RotateCcw /></button><button onClick={() => void exportCurrent()} disabled={!activePhoto || isExporting} type="button"><Download />{isExporting ? '导出中' : '导出'}</button><button className="look-apply-cta" disabled={!activePhoto || matchStep >= 0} onClick={() => setMatchStep(0)} type="button"><Wand2 />{collectionLock && photos.length > 1 ? `应用 LOOK 至 ${photos.length} 张` : '应用当前照片'}</button></div></aside>
      <aside className="look-mode-rail"><button className={fineTuneSection === 'ai' ? 'is-active' : ''} aria-label="AI LOOK" onClick={() => openFineTune('ai')} type="button"><Sparkles /></button><button aria-label="LOOKS" onClick={() => setView('looks')} type="button"><Grid3X3 /></button><button className={fineTuneSection === 'color' ? 'is-active' : ''} aria-label="色彩" onClick={() => openFineTune('color')} type="button"><Palette /></button><button className={fineTuneSection === 'light' ? 'is-active' : ''} aria-label="光线" onClick={() => openFineTune('light')} type="button"><Sun /></button><button className={fineTuneSection === 'film' ? 'is-active' : ''} aria-label="胶片" onClick={() => openFineTune('film')} type="button"><Film /></button><i /><button aria-label="导出" disabled={!activePhoto || isExporting} onClick={() => void exportCurrent()} type="button"><Download /></button></aside>
    </main> : null}

    {view === 'looks' ? <main className="look-asset-page"><section className="look-page-intro"><div><span>YOUR COLLECTION</span><h1>我的 LOOKS</h1><p>由 AI 从参考摄影中学习得到的视觉语言，可以稳定应用到任何作品。</p></div><button onClick={() => setView('create')} type="button"><Plus />创建 LOOK</button></section><section className="look-card-grid">{looks.map((look, index) => <article className="look-card" key={look.id} style={{ '--index': index } as React.CSSProperties}><div className="look-card-cover"><img alt={look.name} src={look.cover} /><span><Images />{look.referenceCount} 张参考</span><button aria-label={`${look.name} 更多操作`} onClick={() => setOpenLookMenu((current) => current === look.id ? null : look.id)} type="button"><MoreHorizontal /></button>{openLookMenu === look.id ? <div className="look-card-menu"><button onClick={() => { setSelectedLookId(look.id); setCreatedLook(null); setView('analysis'); }} type="button">查看详情</button><button onClick={() => setLooks((current) => [{ ...look, id: `copy-${makeId()}`, name: `${look.name} COPY`, created: true }, ...current])} type="button">复制</button>{look.created ? <button onClick={() => setLooks((current) => current.filter((item) => item.id !== look.id))} type="button">删除</button> : null}</div> : null}<button className="look-card-apply" onClick={() => applyLook(look)} type="button">应用 LOOK <ArrowRight /></button></div><div className="look-card-copy"><h2>{look.name}</h2><p>{look.description}</p><div>{look.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><small>适合</small><strong>{look.bestFor.slice(0, 2).join(' · ')}</strong></div></article>)}</section></main> : null}

    {view === 'create' ? <main className="look-asset-page look-create-page"><section className="look-page-intro"><div><span>CREATE A LOOK</span><h1>你想要什么样的摄影感觉？</h1><p>把你喜欢的摄影作品交给 AI。我们会学习共同的光线、色彩、镜头与胶片语言。</p></div><em>01 · 参考照片</em></section><div className="look-create-layout"><section className="look-reference-workspace">{references.length === 0 ? <EmptyDropZone description="3–12 张效果最佳 · JPG / PNG / WEBP" onClick={() => referenceInputRef.current?.click()} onDrop={(files) => void addReferences(files)} title="添加参考照片" /> : <><header><span>参考组</span><b>{references.length} / 12</b></header><div className="look-reference-grid">{references.map((reference, index) => <article key={reference.id}><img alt={`参考照片 ${index + 1}`} src={reference.src} /><span>{String(index + 1).padStart(2, '0')}</span><button aria-label="移除参考照片" onClick={() => setReferences((current) => current.filter((item) => item.id !== reference.id))} type="button"><X /></button></article>)}{references.length < 12 ? <button onClick={() => referenceInputRef.current?.click()} type="button"><Plus /><span>继续添加</span></button> : null}</div></>}</section><aside className="look-learning-panel"><span>AI LOOK LEARNING</span><h2>{references.length === 0 ? 'AI 将从参考照片中学习' : references.length < 3 ? '参考数量不足' : '正在理解共同摄影语言'}</h2>{references.length === 0 ? <ul><li><Sun />光线方向与光比</li><li><Palette />白平衡与综合色彩</li><li><ScanLine />肤色与高光阴影响应</li><li><Film />胶片颗粒与镜头质感</li><li><Aperture />摄影整体氛围</li></ul> : <><div className="look-reference-status"><b>{references.length} 张参考照片</b><small>{references.length < 3 ? '建议至少加入 3 张具有相近摄影语言的照片' : '视觉一致性：优秀'}</small></div>{references.length >= 3 ? <div className="look-learning-metrics"><Metric label="光线" value={91} /><Metric label="色彩" value={94} /><Metric label="质感" value={88} /></div> : null}{references.length >= 6 ? <div className="look-outlier"><img alt="差异参考" src={references[references.length - 1].src} /><span><b>发现 1 张差异参考</b><small>夜景/闪光特征 · 匹配度 23%</small></span><button onClick={() => setReferences((current) => current.slice(0, -1))} type="button">忽略</button></div> : null}</>}<div className="look-learning-note"><ShieldCheck /><span><b>只学习摄影语言</b><small>人物、服装和场景内容不会成为 LOOK 的组成部分</small></span></div><button className="look-learn-cta" disabled={references.length < 3 || analysisStep >= 0} onClick={() => setAnalysisStep(0)} type="button"><Sparkles />分析摄影风格</button></aside></div>{analysisStep >= 0 ? <div className="look-building-overlay"><div className="look-building-backdrop" style={{ backgroundImage: `url(${references[analysisStep % references.length]?.src})` }} /><span><Aperture /></span><small>BUILDING YOUR LOOK</small><h2>{ANALYSIS_STEPS[analysisStep]}</h2><div>{ANALYSIS_STEPS.map((_, index) => <i className={index <= analysisStep ? 'is-active' : ''} key={index} />)}</div></div> : null}</main> : null}

    {view === 'analysis' && analysisLook ? <main className="look-asset-page look-analysis-page"><section className="look-analysis-head"><button onClick={() => setView(createdLook ? 'create' : 'looks')} type="button"><ArrowLeft />返回</button><div><span>LOOK CREATED</span><h1>{analysisLook.name}</h1><p>{analysisLook.description} · 学习自 {analysisLook.referenceCount} 张参考照片</p></div><aside><button onClick={saveLook} type="button"><Save />{lookSaved ? '已保存' : '保存 LOOK'}</button><button onClick={() => tryLook(analysisLook)} type="button"><Wand2 />立即试用</button></aside></section><ReferenceMosaic label={`${analysisLook.name} · LOOK CREATED`} sources={referenceSources} /><section className="look-analysis-summary"><span>AI 看到了什么</span><h2>强方向性暖阳、冷青灰阴影与克制的 35mm 负片质感。</h2><div><article><Sun /><span><b>光线</b><p>强方向性自然日光<br />中高光比<br />暖色太阳高光<br />冷青灰环境阴影</p></span></article><article><Palette /><span><b>色彩</b><p>暖象牙白<br />自然桃金肤色<br />低饱和蓝绿色<br />轻微褪色色彩</p></span></article><article><Aperture /><span><b>镜头</b><p>约 35–50mm 视觉<br />中等景深<br />低数字锐化<br />自然光学柔和度</p></span></article><article><Film /><span><b>胶片</b><p>35mm 彩色负片感<br />细颗粒<br />柔和高光压缩<br />轻微模拟质感</p></span></article></div></section><section className="look-analysis-data"><article><span>LOOK DNA</span>{analysisLook.dna.map((item) => <div className="look-dna-row" key={item.label}><b>{item.label}</b><i><em style={{ width: `${item.value}%` }} /></i><output>{item.value}</output></div>)}</article><article><span>色彩核心</span><div className="look-color-signature">{analysisLook.colors.map((color) => <div key={color.name}><i style={{ background: color.value }} /><b>{color.name}</b></div>)}</div></article><article><span>适合</span><div className="look-scene-tags is-good">{analysisLook.bestFor.map((item) => <em key={item}>{item}</em>)}</div><span>不建议</span><div className="look-scene-tags">{analysisLook.lessFor.map((item) => <em key={item}>{item}</em>)}</div></article></section></main> : null}

    {helpOpen ? <div className="look-modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setHelpOpen(false); }} role="presentation"><section aria-labelledby="look-help-title" aria-modal="true" className="look-help-dialog" role="dialog"><header><div><span>QUICK START</span><h2 id="look-help-title">摄影实验室使用指南</h2></div><button aria-label="关闭使用指南" onClick={() => setHelpOpen(false)} type="button"><X /></button></header><ol><li><b>01</b><span><strong>添加照片</strong><small>点击左侧加号或将照片拖入画布，最多支持 20 张。</small></span></li><li><b>02</b><span><strong>选择 LOOK</strong><small>从 LOOKS 资产库选择摄影语言，并查看 AI 适配度。</small></span></li><li><b>03</b><span><strong>决定迁移范围</strong><small>色彩匹配保留原光线；完整摄影匹配会重建高光与阴影。</small></span></li><li><b>04</b><span><strong>检查并导出</strong><small>拖动前后对比线，使用色彩、光线和胶片面板微调后导出。</small></span></li></ol><div className="look-shortcuts"><span>快捷键</span><div><kbd>Ctrl / ⌘ + Z</kbd><small>撤销</small><kbd>Ctrl / ⌘ + Shift + Z</kbd><small>重做</small><kbd>G</kbd><small>网格</small><kbd>0</kbd><small>适配画布</small></div></div><footer><button onClick={() => { setHelpOpen(false); setView('looks'); }} type="button">浏览 LOOKS</button><button onClick={() => { setHelpOpen(false); targetInputRef.current?.click(); }} type="button">添加照片</button></footer></section></div> : null}
    {toast ? <div aria-live="polite" className="look-toast"><CheckCircle2 /><span>{toast}</span></div> : null}
  </div>;
};

export default ModelFactoryApp;
