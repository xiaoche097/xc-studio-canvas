import React, { useState, useRef, useEffect } from 'react';
import { 
  Download, 
  Loader2, 
  Maximize2, 
  Sparkles, 
  X, 
  Zap, 
  ImageIcon, 
  Plus, 
  Info, 
  ChevronRight, 
  Check,
  ArrowRight,
  Wand2
} from 'lucide-react';
import { AspectRatio, ImageResolution } from '../Cyzx4/types';
import { generateImageToImage, refineModificationPrompt } from '../Cyzx4/services/geminiService';
import { compressImage, getErrorMessage } from '../Cyzx4/utils/apiHelpers';
import { useImagePaste } from '../Cyzx4/hooks/useImagePaste';

// --- Types & Constants ---

type ModificationMode = 
  | 'pattern-on-body' 
  | 'style-mod' 
  | 'pattern-design' 
  | 'line-filling' 
  | 'fabric-on-body' 
  | 'color-change' 
  | 'free-design';

interface GenerationTask {
  id: string;
  status: 'refining' | 'generating' | 'success' | 'error';
  mode: ModificationMode;
  prompt: string;
  refinedPrompt?: string;
  img1: string;
  img1File: File;
  img2?: string;
  img2File?: File;
  results: string[];
  timestamp: number;
  settings: {
    model: string;
    ratio: string;
    res: string;
    count: number;
  };
  error?: string;
}

interface ModeOption {
  id: ModificationMode;
  label: string;
}

const MODES: ModeOption[] = [
  { id: 'pattern-on-body', label: '图案上身' },
  { id: 'style-mod', label: '款式改款' },
  { id: 'pattern-design', label: '图案设计' },
  { id: 'line-filling', label: '服装线稿填充' },
  { id: 'fabric-on-body', label: '面料上身' },
  { id: 'color-change', label: '颜色变换' },
  { id: 'free-design', label: '自由设计' },
];

const EXAMPLES = [
  {
    id: 1,
    title: '服装图案变换',
    mode: 'pattern-on-body',
    imgSource: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=200&q=80',
    imgMaterial: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=200&q=80',
    imgResult: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=200&q=80',
    prompt: '将 图1 中 恤衫 区域上的图案，改成 图2 中的图案，图中其他的元素保持不变，保证衣服的褶皱符合真实规律。'
  },
  {
    id: 2,
    title: '服装添加图案',
    mode: 'pattern-on-body',
    imgSource: 'https://images.unsplash.com/photo-1554568218-0f1715e72254?auto=format&fit=crop&w=200&q=80',
    imgMaterial: 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=200&q=80',
    imgResult: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=200&q=80',
    prompt: '在 图1 的 胸前 区域添加 图2 的图案，使其完美融合到服装材质中。'
  },
  {
    id: 3,
    title: '服装局部添加图案',
    mode: 'pattern-on-body',
    imgSource: 'https://images.unsplash.com/photo-1583743814966-8936f5b721fa?auto=format&fit=crop&w=200&q=80',
    imgMaterial: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=200&q=80',
    imgResult: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=200&q=80',
    prompt: '在 图1 的 袖口 区域添加 图2 的精细花纹，保持原有的面料褶皱。'
  },
  {
    id: 4,
    title: '印花/Logo消除',
    mode: 'style-mod',
    imgSource: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=200&q=80',
    imgMaterial: null,
    imgResult: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=200&q=80',
    prompt: '消除 图1 中的所有印花和Logo，使服装变为纯色效果，保持材质自然。'
  }
];

// --- Helper Components ---

const AspectRatioIcon: React.FC<{ ratio: string; active: boolean }> = ({ ratio, active }) => {
  const dims = ratio === '1:1' ? 'w-4 h-4' : ratio === '3:4' ? 'w-3 h-4' : 'w-4 h-3';
  return (
    <div className={`border-2 rounded-sm transition-all ${dims} ${active ? 'border-[#ED6D46] bg-[#ED6D46]/20' : 'border-slate-300'}`} />
  );
};

const ExampleModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSelect: (mode: ModificationMode, prompt: string) => void;
  }> = ({ isOpen, onClose, onSelect }) => {
    if (!isOpen) return null;
  
    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-fade-in" onClick={onClose}>
        <div className="bg-white rounded-[40px] shadow-[0_30px_100px_-20px_rgba(0,0,0,0.5)] w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col relative" onClick={e => e.stopPropagation()}>
          <div className="p-8 border-b border-slate-100 flex items-center justify-between">
             <div className="flex items-center gap-4">
                <div className="bg-[#ED6D46] p-2 rounded-2xl shadow-lg shadow-orange-100">
                    <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight">选择模板</h2>
                    <p className="text-xs font-bold text-slate-400 mt-0.5 tracking-wider uppercase">Select Template / Case Inspiration</p>
                </div>
             </div>
             <button onClick={onClose} className="p-3 hover:bg-slate-50 rounded-full transition-all group">
                <X className="w-6 h-6 text-slate-300 group-hover:text-slate-600 transition-colors" />
             </button>
          </div>
  
          <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
            <div className="grid grid-cols-2 gap-8">
               {EXAMPLES.map(ex => (
                  <div key={ex.id} className="group flex flex-col bg-slate-50/50 rounded-[32px] border border-slate-100 hover:border-orange-200 hover:bg-white p-6 transition-all hover:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.08)]">
                     <div className="flex items-center justify-between mb-6">
                        <span className="text-[15px] font-black text-slate-700">{ex.title}</span>
                        <button 
                            onClick={() => { onSelect(ex.mode as any, ex.prompt); onClose(); }}
                            className="flex items-center gap-2 px-4 py-1.5 bg-white border border-slate-200 rounded-full text-[11px] font-black text-slate-500 hover:bg-[#ED6D46] hover:text-white hover:border-[#ED6D46] transition-all shadow-sm"
                        >
                            使用模板 <Check className="w-3 h-3" />
                        </button>
                     </div>
  
                     <div className="flex items-center gap-3">
                        {/* Box 1 */}
                        <div className="flex-1 space-y-2">
                           <div className="aspect-[4/5] bg-white rounded-2xl border border-slate-100 overflow-hidden relative shadow-sm">
                              <img src={ex.imgSource} className="w-full h-full object-cover" />
                              <div className="absolute top-2 left-2 bg-[#ED6D46] text-white text-[8px] font-black px-1.5 py-0.5 rounded-md">图1</div>
                           </div>
                           <p className="text-[9px] font-bold text-slate-400 text-center uppercase tracking-widest">服装图</p>
                        </div>
  
                         {ex.imgMaterial ? (
                            <>
                              <div className="flex items-center justify-center bg-slate-100 w-6 h-6 rounded-full"><Plus className="w-3 h-3 text-slate-400" /></div>
                              {/* Box 2 */}
                              <div className="flex-1 space-y-2">
                                 <div className="aspect-[4/5] bg-white rounded-2xl border border-slate-100 overflow-hidden relative shadow-sm">
                                    <img src={ex.imgMaterial} className="w-full h-full object-cover" />
                                    <div className="absolute top-2 left-2 bg-[#ED6D46] text-white text-[8px] font-black px-1.5 py-0.5 rounded-md">图2</div>
                                 </div>
                                 <p className="text-[9px] font-bold text-slate-400 text-center uppercase tracking-widest">图案</p>
                              </div>
                            </>
                         ) : (
                             <div className="flex-1" />
                         )}
                        
                        <div className="flex items-center justify-center w-8 h-8"><ArrowRight className="w-4 h-4 text-[#ED6D46] animate-pulse" /></div>
  
                        {/* Box Result */}
                        <div className="flex-1 space-y-2">
                           <div className="aspect-[4/5] bg-[#ED6D46]/5 rounded-2xl border-2 border-dashed border-orange-200 overflow-hidden relative shadow-inner">
                              <img src={ex.imgResult} className="w-full h-full object-cover opacity-90" />
                              <div className="absolute top-2 left-2 bg-slate-800 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase">生成图</div>
                           </div>
                           <p className="text-[9px] font-bold text-[#ED6D46] text-center uppercase tracking-widest">效果预览</p>
                        </div>
                     </div>
                  </div>
               ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

const ConfigPopover: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  selectedModel: string;
  setSelectedModel: (v: 'nanobanana2' | 'nanobananapro') => void;
  selectedRatio: AspectRatio | 'auto';
  setSelectedRatio: (v: AspectRatio | 'auto') => void;
  selectedRes: ImageResolution;
  setSelectedRes: (v: ImageResolution) => void;
}> = ({ isOpen, onClose, selectedModel, setSelectedModel, selectedRatio, setSelectedRatio, selectedRes, setSelectedRes }) => {
  if (!isOpen) return null;

  return (
    <div className="absolute bottom-full right-0 mb-6 w-[420px] bg-white rounded-[32px] shadow-[0_20px_70px_-10px_rgba(0,0,0,0.3)] border border-slate-200 p-8 z-[120] animate-slide-up origin-bottom-right max-h-[70vh] overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-8">
        <div>
            <h3 className="text-sm font-black text-slate-800 tracking-tight">高级项目配置</h3>
            <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">Project Settings</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><X className="w-5 h-5" /></button>
      </div>

      <div className="space-y-8">
        <div className="grid grid-cols-2 gap-8">
            {/* Model Select */}
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">生成模型 / Engine</label>
              <div className="flex flex-col gap-2">
                {[
                  { id: 'nanobananapro', label: 'Pro', desc: '经典稳定' },
                  { id: 'nanobanana2', label: '标准版', desc: '性价比高' }
                ].map(m => (
                  <button 
                    key={m.id}
                    onClick={() => setSelectedModel(m.id as any)}
                    className={`p-3.5 rounded-2xl border transition-all text-left relative overflow-hidden group ${selectedModel === m.id ? 'border-[#ED6D46] bg-[#FFF0EB]/50 shadow-sm' : 'border-slate-100 bg-slate-50/50 hover:border-orange-300'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[12px] font-black ${selectedModel === m.id ? 'text-[#ED6D46]' : 'text-slate-600'}`}>{m.label}</span>
                      {selectedModel === m.id && <Check className="w-4 h-4 text-[#ED6D46]" />}
                    </div>
                    <div className={`text-[10px] font-bold ${selectedModel === m.id ? 'text-orange-400' : 'text-slate-400'}`}>{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Resolution */}
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">分辨率 / Resolution</label>
              <div className="flex flex-col gap-2">
                 {[
                   { id: ImageResolution.RES_2K, label: '高清 2k', desc: '推荐', badge: '推荐' },
                   { id: ImageResolution.RES_4K, label: '超清 4k', desc: '极致', badge: '极清' },
                   { id: ImageResolution.RES_1K, label: '1k', desc: '快速', badge: null }
                 ].map(res => (
                   <button 
                     key={res.id}
                     onClick={() => setSelectedRes(res.id)}
                     className={`flex items-center justify-between px-4 py-3 rounded-2xl border transition-all ${selectedRes === res.id ? 'border-orange-500 bg-[#FFF0EB]/50' : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50'}`}
                   >
                     <span className={`text-[11px] font-black ${selectedRes === res.id ? 'text-[#ED6D46]' : 'text-slate-600'}`}>{res.label}</span>
                     {res.badge && (
                       <span className="bg-[#ED6D46] text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase">{res.badge}</span>
                     )}
                   </button>
                 ))}
              </div>
            </div>
        </div>

        {/* Aspect Ratio */}
        <div className="space-y-4 border-t border-slate-50 pt-6">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">选择比例 / Aspect Ratio</label>
            <div className="grid grid-cols-5 gap-3">
                {[
                  { id: 'auto', label: '智能' },
                  { id: AspectRatio.PORTRAIT_3_4, label: '3:4' },
                  { id: AspectRatio.SQUARE, label: '1:1' },
                  { id: AspectRatio.PORTRAIT_9_16, label: '9:16' },
                  { id: AspectRatio.LANDSCAPE_16_9, label: '16:9' },
                  { id: AspectRatio.LANDSCAPE_4_3, label: '4:3' },
                  { id: AspectRatio.LANDSCAPE_3_2, label: '3:2' },
                  { id: AspectRatio.PORTRAIT_2_3, label: '2:3' },
                  { id: AspectRatio.PORTRAIT_4_5, label: '4:5' }
                ].map(r => (
                  <button 
                    key={r.id}
                    onClick={() => setSelectedRatio(r.id as any)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border transition-all ${selectedRatio === r.id ? 'border-orange-500 bg-[#FFF0EB] shadow-sm' : 'border-slate-100 bg-white hover:border-orange-200'}`}
                  >
                    <div className="h-4 flex items-center justify-center">
                        {r.id === 'auto' ? (
                           <Sparkles className={`w-3.5 h-3.5 ${selectedRatio === 'auto' ? 'text-[#ED6D46]' : 'text-slate-300'}`} />
                        ) : (
                           <AspectRatioIcon ratio={r.label} active={selectedRatio === r.id} />
                        )}
                    </div>
                    <span className={`text-[9px] font-black mt-1.5 ${selectedRatio === r.id ? 'text-[#ED6D46]' : 'text-slate-500'}`}>{r.label}</span>
                  </button>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};

const ClothingModificationTab: React.FC = () => {
  const [activeMode, setActiveMode] = useState<ModificationMode>('pattern-on-body');
  
  // Image states
  const [img1File, setImg1File] = useState<File | null>(null);
  const [img1Url, setImg1Url] = useState<string | null>(null);
  const [img2File, setImg2File] = useState<File | null>(null);
  const [img2Url, setImg2Url] = useState<string | null>(null);
  
  // Settings
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState<'nanobanana2' | 'nanobananapro'>('nanobanana2');
  const [selectedRatio, setSelectedRatio] = useState<AspectRatio | 'auto'>('auto');
  const [selectedRes, setSelectedRes] = useState<ImageResolution>(ImageResolution.RES_2K);
  const [generateCount, setGenerateCount] = useState(1);
  
  // UI states
  const [tasks, setTasks] = useState<GenerationTask[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState('智绘中...');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isExampleOpen, setIsExampleOpen] = useState(false);
  const taskListRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top when a new task is added
  useEffect(() => {
    if (tasks.length > 0 && taskListRef.current) {
      taskListRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [tasks.length]);

  // ---- Handlers ----
  const handleUpload = (type: 1 | 2, file: File) => {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    if (type === 1) {
      if (img1Url) URL.revokeObjectURL(img1Url);
      setImg1File(file);
      setImg1Url(url);
    } else {
      if (img2Url) URL.revokeObjectURL(img2Url);
      setImg2File(file);
      setImg2Url(url);
    }
  };

  const removeImage = (type: 1 | 2) => {
    if (type === 1) {
      if (img1Url) URL.revokeObjectURL(img1Url);
      setImg1File(null);
      setImg1Url(null);
    } else {
      if (img2Url) URL.revokeObjectURL(img2Url);
      setImg2File(null);
      setImg2Url(null);
    }
  };

  const getTemplate = (mode: ModificationMode) => {
    const templates: Record<ModificationMode, string> = {
      'pattern-on-body': `将 图1 中 描述服装类型 区域上的图案，改成 图2 中的图案，图中其他的元素保持不变，保证衣服的褶皱符合真实世界的褶皱规律。`,
      'style-mod': `依据 图2 的服装剪裁风格，对 图1 中的 领形/袖子/下摆 进行款式改款，保留原有的布料质感，使版型更加前卫。`,
      'pattern-design': `参考 图2 的设计美学，在 图1 的 胸前/全身 位置设计并合成全新的印花纹样。`,
      'line-filling': `将 图1 所示的 连衣裙/外套 线稿进行照片级上色填充，参考 图2 的材质属性。`,
      'fabric-on-body': `将 图1 中 丝绸/棉麻 的面料质感改为 图2 所示的材质。`,
      'color-change': `将 图1 中 主色调 的颜色改为 图2 所示的主色调。`,
      'free-design': '根据提供的服装进行自由创意优化。'
    };
    return templates[mode];
  };

  // Switch template on mode change
  React.useEffect(() => {
    setPrompt(getTemplate(activeMode));
  }, [activeMode]);

  // Global Paste Listener
  useImagePaste((files) => {
    const file = files[0];
    if (!file || !file.type.startsWith('image/')) return;
    
    if (!img1File) {
      handleUpload(1, file);
    } else if (!img2File) {
      handleUpload(2, file);
    } else {
      handleUpload(1, file);
    }
  });

  const handleDownload = (imageUrl: string, index: number) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `XC-Studio-Design-${Date.now()}-${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBatchDownload = (taskResults: string[]) => {
    taskResults.forEach((url, i) => {
      setTimeout(() => handleDownload(url, i), i * 300); // Stagger for browser compatibility
    });
  };

  const updateTask = (id: string, updates: Partial<GenerationTask>) => {
    if (updates.id === 'delete') {
      setTasks(prev => prev.filter(t => t.id !== id));
      return;
    }
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const handleEditTask = (task: GenerationTask) => {
    setActiveMode(task.mode);
    setPrompt(task.prompt);
    setImg1File(task.img1File);
    setImg1Url(task.img1);
    if (task.img2File) {
        setImg2File(task.img2File);
        setImg2Url(task.img2 || null);
    } else {
        setImg2File(null);
        setImg2Url(null);
    }
    setSelectedModel(task.settings.model as any);
    setSelectedRatio(task.settings.ratio as any);
    setSelectedRes(task.settings.res as any);
    setGenerateCount(task.settings.count);
    // Scroll to bottom form
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  const handleGenerate = async (retryTask?: GenerationTask) => {
    const sourceImg1 = retryTask ? retryTask.img1File : img1File;
    const sourceImg2 = retryTask ? retryTask.img2File : img2File;
    const currentPrompt = retryTask ? retryTask.prompt : prompt;
    const currentMode = retryTask ? retryTask.mode : activeMode;

    if (!sourceImg1) {
        alert('请上传 图1 (原始图)');
        return;
    }

    const taskId = retryTask ? retryTask.id : `task-${Date.now()}`;
    
    if (!retryTask) {
        const newTask: GenerationTask = {
            id: taskId,
            status: 'refining',
            mode: currentMode,
            prompt: currentPrompt,
            img1: img1Url || '',
            img1File: sourceImg1,
            img2: img2Url || undefined,
            img2File: sourceImg2 || undefined,
            results: [],
            timestamp: Date.now(),
            settings: {
                model: selectedModel,
                ratio: selectedRatio,
                res: selectedRes,
                count: generateCount
            }
        };
        setTasks(prev => [newTask, ...prev]);
        setIsGenerating(true);
    } else {
        updateTask(taskId, { status: 'refining', error: undefined });
    }

    try {
      const img1Compressed = await compressImage(sourceImg1, 1024, 0.9); 
      const inputImages: { base64: string; mimeType: string }[] = [
        { base64: img1Compressed.base64, mimeType: img1Compressed.mime }
      ];

      if (sourceImg2) {
        const img2Compressed = await compressImage(sourceImg2, 1024, 0.9);
        inputImages.push({ base64: img2Compressed.base64, mimeType: img2Compressed.mime });
      }

      const refinedPrompt = await refineModificationPrompt(currentMode, currentPrompt, inputImages);
      updateTask(taskId, { status: 'generating', refinedPrompt });
      
      const generationPromises = Array.from({ length: retryTask ? retryTask.settings.count : generateCount }).map(() => 
        generateImageToImage(inputImages, refinedPrompt, {
            aspectRatio: selectedRatio === 'auto' ? undefined : (retryTask ? retryTask.settings.ratio : selectedRatio) as AspectRatio,
            resolution: (retryTask ? retryTask.settings.res : selectedRes) as ImageResolution,
            modelId: (retryTask ? retryTask.settings.model : selectedModel) as any,
            workflowHint: 'clothing-modification'
        })
      );

      const allResultsFlat = (await Promise.all(generationPromises)).flat().filter(Boolean);
      
      if (allResultsFlat.length === 0) {
        throw new Error('渲染引擎未返回有效图像，请尝试更换模型。');
      }

      updateTask(taskId, { status: 'success', results: allResultsFlat });

    } catch (err) {
      console.error(err);
      updateTask(taskId, { status: 'error', error: getErrorMessage(err) });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateTask = (task: GenerationTask) => {
    handleGenerate(task);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden font-sans relative">
      {/* 1. Results Area (Task List) */}
      <div ref={taskListRef} className="flex-1 overflow-y-auto custom-scrollbar p-10 space-y-8 pb-24">
        <div className="max-w-6xl mx-auto space-y-8">
          
          {tasks.length === 0 && (
            <div className="h-[60vh] flex flex-col items-center justify-center text-slate-200 gap-8 select-none animate-fade-in">
                <div className="bg-white p-10 rounded-[48px] shadow-sm border border-slate-100">
                  <ImageIcon className="w-32 h-32 stroke-[0.3] text-[#ED6D46]/20" />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-xl font-black text-slate-400">开启您的跨时代服装改款之旅</p>
                  <p className="text-sm font-bold text-slate-300 uppercase tracking-widest">Start your design journey below</p>
                </div>
            </div>
          )}

          {tasks.map((task) => (
            <div key={task.id} className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-6 space-y-5 animate-slide-up hover:shadow-lg transition-all duration-500 group/card relative overflow-hidden">
               {/* Header Row */}
               <div className="flex items-center justify-between pb-3 border-b border-slate-50">
                  <div className="flex items-center gap-3">
                     <div className="bg-[#ED6D46] px-2.5 py-0.5 rounded-full text-white text-[9px] font-black uppercase tracking-wider shadow-sm">
                       {MODES.find(m => m.id === task.mode)?.label}
                     </div>
                     <span className="text-[9px] text-slate-300 font-bold uppercase tracking-wider">{new Date(task.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                     <button onClick={() => updateTask(task.id, { id: 'delete' })} className="p-1.5 hover:bg-slate-50 rounded-full transition-colors text-slate-300 hover:text-red-400 group/del" title="移除此任务">
                       <X className="w-4 h-4" />
                     </button>
                  </div>
               </div>
               
               {/* Main Content Row (Horizontal) */}
               <div className="flex gap-6 items-stretch">
                  {/* Left: Mini Inputs */}
                  <div className="flex flex-col gap-2 shrink-0">
                     <div className="w-[80px] h-[100px] rounded-xl bg-slate-50 border border-slate-100 overflow-hidden relative group/img shadow-sm">
                        <img src={task.img1} className="w-full h-full object-cover" />
                        <div className="absolute top-1 left-1 bg-slate-900/80 backdrop-blur-md text-white text-[7px] font-black px-1.5 py-0.5 rounded-md z-10 transition-opacity group-hover/img:opacity-0">图1</div>
                     </div>
                     {task.img2 && (
                        <div className="w-[80px] h-[100px] rounded-xl bg-slate-50 border border-slate-100 overflow-hidden relative group/img shadow-sm">
                            <img src={task.img2} className="w-full h-full object-cover" />
                            <div className="absolute top-1 left-1 bg-slate-900/80 backdrop-blur-md text-white text-[7px] font-black px-1.5 py-0.5 rounded-md z-10 transition-opacity group-hover/img:opacity-0">图2</div>
                        </div>
                     )}
                  </div>

                  {/* Middle: Content & Results */}
                  <div className="flex-1 flex flex-col gap-4">
                     {/* Prompt Snippet */}
                     <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 cursor-default hover:bg-white transition-colors group/prompt">
                        <p className="text-[13px] font-bold text-slate-600 italic leading-relaxed line-clamp-2">
                          <span className="text-[#ED6D46] text-sm opacity-30 mr-1 font-serif">"</span>
                          {task.prompt}
                          <span className="text-[#ED6D46] text-sm opacity-30 ml-1 font-serif">"</span>
                        </p>
                        {task.refinedPrompt && (
                           <div className="text-[8px] font-black text-orange-400 mt-2 flex items-center gap-1.5 uppercase tracking-widest animate-fade-in">
                             <Wand2 className="w-2.5 h-2.5" /> 专家方案重写已应用
                           </div>
                        )}
                     </div>

                     {/* Results Area */}
                     <div className="h-[220px] flex items-center justify-center bg-white rounded-2xl border-2 border-dashed border-slate-50 relative overflow-hidden group/results-container">
                        {task.status === 'refining' || task.status === 'generating' ? (
                           <div className="flex flex-col items-center justify-center gap-4 w-full h-full">
                              <div className="relative scale-75">
                                 <Loader2 className="w-10 h-10 text-[#ED6D46] animate-spin stroke-[1.5]" />
                                 <div className="absolute inset-0 flex items-center justify-center">
                                    <Zap className="w-4 h-4 text-orange-400 animate-pulse" />
                                 </div>
                              </div>
                              <div className="text-center space-y-1.5">
                                 <span className="block text-[10px] font-black text-[#ED6D46] tracking-[2.5px] uppercase animate-pulse">
                                    {task.status === 'refining' ? 'REFINING' : 'RENDERING'}
                                 </span>
                                 <span className="block text-[10px] font-bold text-slate-300">智绘创作中，请稍候...</span>
                              </div>
                           </div>
                        ) : task.status === 'error' ? (
                           <div className="flex items-center gap-5 p-5 bg-red-50/50 rounded-2xl border border-red-100 w-full max-w-lg mx-6 group-hover/results-container:border-red-200 transition-colors">
                              <div className="bg-white p-2.5 rounded-full shadow-sm shrink-0 border border-red-50">
                                 <X className="w-5 h-5 text-red-400" />
                              </div>
                              <div className="flex-1 flex flex-col gap-1">
                                 <p className="text-[12px] font-bold text-red-500 line-clamp-2 leading-relaxed">{task.error}</p>
                                 <button onClick={() => handleGenerate(task)} className="text-[10px] font-black text-[#ED6D46] hover:text-[#ED6D46]/80 w-fit uppercase tracking-wider mt-1 flex items-center gap-1.5 transition-colors">
                                    <Zap className="w-3 h-3" /> 点击重试
                                 </button>
                              </div>
                           </div>
                        ) : (
                           <div className="w-full h-full p-3 overflow-x-auto no-scrollbar scroll-smooth">
                              <div className="flex gap-4 h-full min-w-full">
                                 {task.results.map((url, i) => (
                                   <div key={i} className="h-full aspect-[3/4] rounded-xl bg-slate-50 border border-slate-100 overflow-hidden relative group/res cursor-pointer shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-300 shrink-0" onClick={() => setPreviewImage(url)}>
                                       <img src={url} className="w-full h-full object-cover" />
                                       <div className="absolute top-2.5 left-2.5 bg-[#ED6D46] text-white text-[7px] font-black px-2 py-0.5 rounded-md z-10 shadow-lg ring-1 ring-white/20">结果 {i + 1}</div>
                                       <div className="absolute inset-0 bg-gradient-to-t from-[#ED6D46]/40 via-transparent to-transparent opacity-0 group-hover/res:opacity-100 transition-all flex items-center justify-center gap-3">
                                           <div className="flex gap-2">
                                              <button onClick={(e) => { e.stopPropagation(); handleDownload(url, i); }} className="w-9 h-9 text-white bg-[#ED6D46] p-2.5 rounded-xl shadow-2xl hover:scale-110 active:scale-90 transition-all flex items-center justify-center"><Download className="w-5 h-5" /></button>
                                              <button onClick={(e) => { e.stopPropagation(); setPreviewImage(url); }} className="w-9 h-9 text-slate-800 bg-white p-2.5 rounded-xl shadow-2xl hover:scale-110 active:scale-90 transition-all flex items-center justify-center"><Maximize2 className="w-5 h-5 text-[#ED6D46]" /></button>
                                           </div>
                                       </div>
                                   </div>
                                 ))}
                              </div>
                           </div>
                        )}
                     </div>
                  </div>
               </div>

               {/* 3. Actions Row (Footer) */}
               <div className="flex items-center justify-between pt-5 border-t border-slate-50/80">
                  <div className="flex items-center gap-6">
                     <div className="flex flex-col gap-0.5">
                        <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">设计配置</span>
                        <span className="text-[10px] font-bold text-slate-400 capitalize flex items-center gap-2">
                           {task.settings.model.replace('nanobanana', 'NB ')} 
                           <span className="w-1 h-1 bg-slate-200 rounded-full" /> 
                           {task.settings.res} 
                           <span className="w-1 h-1 bg-slate-200 rounded-full" /> 
                           {task.settings.ratio}
                        </span>
                     </div>
                  </div>
                  
                  <div className="flex items-center gap-2.5">
                     <button 
                        onClick={() => handleBatchDownload(task.results)}
                        disabled={task.results.length === 0}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black transition-all border ${task.results.length > 0 ? 'bg-white border-slate-200 text-slate-500 hover:border-[#ED6D46] hover:text-[#ED6D46] hover:shadow-sm' : 'bg-slate-50 border-slate-50 text-slate-200 cursor-not-allowed'}`}
                     >
                        <Download className="w-3.5 h-3.5" /> 批量下载
                     </button>
                     <button 
                        onClick={() => handleEditTask(task)}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-500 hover:border-[#ED6D46] hover:text-[#ED6D46] transition-all rounded-xl text-[11px] font-black shadow-sm"
                     >
                        <Wand2 className="w-3.5 h-3.5" /> 重新编辑
                     </button>
                     <button 
                        onClick={() => handleRegenerateTask(task)}
                        className="flex items-center gap-2 px-5 py-2 bg-[#ED6D46] text-white hover:bg-[#ED6D46]/90 transition-all rounded-xl text-[11px] font-black shadow-lg shadow-orange-100/50 active:scale-95"
                     >
                        <Zap className="w-3.5 h-3.5" /> 再次生成
                     </button>
                  </div>
               </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Consolidated Card UI (Bottom Controller) */}
      <div className="px-8 pb-10 flex flex-col items-center bg-slate-100/90 backdrop-blur-xl border-t border-slate-200/50 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] z-[50]">
        <div className="max-w-6xl w-full flex flex-col gap-5 mt-10">
           {/* Hint Row */}
           <div className="flex items-center justify-between w-full animate-slide-up">
              <div className="flex items-center gap-3 bg-orange-50/90 backdrop-blur-xl border border-orange-100/50 px-6 py-2 rounded-full text-[#ED6D46] shadow-sm">
                 <Info className="w-3.5 h-3.5 text-orange-500" />
                 <span className="text-[12px] font-bold tracking-tight">可以根据对应改款模式对文案模板进行个性化修改</span>
              </div>
              
              <button 
                onClick={() => setIsExampleOpen(true)}
                className="flex items-center gap-2.5 bg-white border border-slate-200 hover:border-orange-400 hover:text-[#ED6D46] transition-all rounded-full px-6 py-2 text-xs font-black shadow-sm group active:scale-95"
              >
                  <Sparkles className="w-4 h-4 text-orange-500 group-hover:rotate-12 transition-transform" />
                  案例模板库
              </button>
           </div>
           
           <div className="bg-white/95 backdrop-blur-3xl rounded-[32px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.15)] border border-slate-200/60 flex flex-col relative z-20">
              {/* Tabs */}
              <div className="flex items-center gap-1 p-2 bg-slate-50/50 border-b border-slate-100 overflow-x-auto no-scrollbar rounded-t-[32px]">
                {MODES.map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => setActiveMode(mode.id)}
                    className={`px-8 py-4 text-[13px] font-black transition-all relative shrink-0 ${
                      activeMode === mode.id 
                        ? 'text-[#ED6D46]' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {mode.label}
                    {activeMode === mode.id && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#ED6D46] rounded-t-full shadow-[0_-2px_10px_rgba(237,109,70,0.3)] anim-scale-x" />
                    )}
                  </button>
                ))}
              </div>

              {/* Body */}
              <div className="p-8 flex gap-8">
                {/* Uploads */}
                <div className="flex gap-4">
                  <UploadSlot id={1} label="上传服装图" url={img1Url} onUpload={f => handleUpload(1, f)} onRemove={() => removeImage(1)} />
                  <UploadSlot id={2} label="上传参考件" url={img2Url} onUpload={f => handleUpload(2, f)} onRemove={() => removeImage(2)} />
                </div>

                 {/* Prompts Area */}
                 <div className="flex-1 flex flex-col group relative animate-fade-in">
                     <textarea 
                       value={prompt}
                       onChange={e => setPrompt(e.target.value)}
                       placeholder="请输入具体改款细节，如：将领口改为圆领，增加品牌刺绣..."
                       className="w-full h-full min-h-[140px] bg-[#FFF0EB]/30 border border-orange-100 rounded-[24px] p-6 text-[15px] font-black leading-relaxed text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-orange-200 focus:ring-8 focus:ring-[#FFF0EB]/50 transition-all resize-none shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] scrollbar-hide"
                     />
                     <div className="absolute bottom-4 right-6 flex items-center gap-2 text-[10px] text-orange-300 font-bold tracking-widest uppercase pointer-events-none opacity-50">
                        <Zap className="w-3 h-3 text-orange-400" />
                        AI DESIGN ENGINE
                     </div>
                 </div>
              </div>

              {/* Footer */}
              <div className="px-8 pb-10 flex items-center justify-between">
                 <div className="flex items-center gap-2 p-2 bg-slate-200/90 rounded-2xl border border-slate-300 shadow-sm hover:border-orange-400 transition-all group relative">
                    <button onClick={() => setIsConfigOpen(!isConfigOpen)} className="px-6 py-2.5 text-[15px] font-black text-slate-700 hover:text-[#ED6D46] transition-colors tracking-tight">
                        {selectedModel === 'nanobananapro' ? 'Pro' : '标准'}
                    </button>
                    <div className="w-px h-6 bg-slate-300 group-hover:bg-orange-300 transition-colors" />
                    <button onClick={() => setIsConfigOpen(!isConfigOpen)} className="px-6 py-2.5 text-[15px] font-black text-slate-700 hover:text-[#ED6D46] transition-colors tracking-tight">
                        {selectedRatio === 'auto' ? '智能' : selectedRatio}
                    </button>
                    <div className="w-px h-6 bg-slate-400 group-hover:bg-orange-400 transition-colors" />
                    <button onClick={() => setIsConfigOpen(!isConfigOpen)} className="flex items-center gap-3 px-6 py-2.5 text-[15px] font-black text-slate-700 hover:text-[#ED6D46] transition-colors tracking-tight">
                        <span>{selectedRes}</span>
                        <ChevronRight className={`w-6 h-6 text-slate-500 transition-transform ${isConfigOpen ? 'rotate-[-90deg]' : 'rotate-90'}`} />
                    </button>
                    <div className="w-px h-6 bg-slate-400 group-hover:bg-orange-400 transition-colors" />
                    <button onClick={() => setGenerateCount(prev => prev >= 4 ? 1 : prev + 1)} className="px-6 py-2.5 text-[15px] font-black text-slate-700 hover:text-[#ED6D46] transition-all flex items-center gap-2 active:scale-95 group/btn">
                        <span>{generateCount}张</span>
                        <div className="w-1.5 h-1.5 bg-[#ED6D46] rounded-full group-hover/btn:animate-ping" />
                    </button>
                    
                    <ConfigPopover 
                      isOpen={isConfigOpen} 
                      onClose={() => setIsConfigOpen(false)}
                      selectedModel={selectedModel}
                      setSelectedModel={setSelectedModel}
                      selectedRatio={selectedRatio}
                      setSelectedRatio={setSelectedRatio}
                      selectedRes={selectedRes}
                      setSelectedRes={setSelectedRes}
                    />
                 </div>
  
                 <button 
                  onClick={() => handleGenerate()}
                  disabled={isGenerating || !img1File}
                  className={`relative group overflow-hidden bg-gradient-to-r from-[#ED6D46] to-[#f97316] text-white px-12 py-5 rounded-[24px] font-black text-[16px] shadow-[0_15px_40px_-10px_rgba(237,109,70,0.5)] hover:shadow-[0_20px_50px_-10px_rgba(237,109,70,0.7)] hover:scale-[1.03] active:scale-[0.97] transition-all disabled:opacity-50 disabled:scale-100 flex items-center gap-3`}
                 >
                    {isGenerating ? (
                      <>
                        <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>正在创作...</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                        <span>开始改款任务</span>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                      </>
                    )}
                 </button>
              </div>
           </div>
        </div>
      </div>

      {/* Examples Modal */}
      <ExampleModal 
        isOpen={isExampleOpen} 
        onClose={() => setIsExampleOpen(false)} 
        onSelect={(mode, p) => {
            setActiveMode(mode);
            setPrompt(p);
        }}
      />

      {/* Preview */}
      {previewImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-10 select-none animate-fade-in" onClick={() => setPreviewImage(null)}>
            <div className="relative max-w-full max-h-full flex items-center justify-center group" onClick={e => e.stopPropagation()}>
                <img src={previewImage} className="max-w-full max-h-full object-contain rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.5)]" />
                
                {/* Float Controls */}
                <div className="absolute top-6 right-6 flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <button 
                      onClick={() => handleDownload(previewImage, 0)}
                      className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white p-4 rounded-2xl transition-all hover:scale-110 border border-white/20"
                      title="下载图片"
                    >
                        <Download className="w-6 h-6" />
                    </button>
                    <button 
                      onClick={() => setPreviewImage(null)}
                      className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white p-4 rounded-2xl transition-all hover:scale-110 border border-white/20"
                      title="关闭预览"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="absolute bottom-[-60px] left-1/2 -translate-x-1/2 text-white/40 text-xs font-bold tracking-widest uppercase">
                    Press anywhere outside to close
                </div>
            </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-slide-up { animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes animScaleX { from { transform: scaleX(0); opacity: 0; } to { transform: scaleX(1); opacity: 1; } }
        .anim-scale-x { animation: animScaleX 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
};

const UploadSlot: React.FC<{ id: number; label: string; url: string | null; onUpload: (f: File) => void; onRemove: () => void }> = ({ id, label, url, onUpload, onRemove }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onUpload(file);
    }
  };

  return (
    <div 
      className="w-[100px] h-[132px] transition-all duration-300"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {url ? (
        <div className="relative group w-full h-full rounded-2xl border-2 border-[#ED6D46] overflow-hidden bg-slate-50 shadow-sm animate-fade-in">
          <img src={url} className="w-full h-full object-contain" />
          <button onClick={onRemove} className="absolute top-1 right-1 bg-white p-1 rounded-full shadow-lg hover:bg-red-50 transition-colors z-10"><X className="w-3 h-3 text-red-500" /></button>
          <div className="absolute top-1 left-1 bg-[#ED6D46] text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-lg">图 {id}</div>
        </div>
      ) : (
        <label 
          className={`flex flex-col items-center justify-center w-full h-full rounded-[24px] border-2 border-dashed transition-all cursor-pointer group/upload ${
            isDragOver 
              ? 'border-orange-500 bg-[#FFF0EB] scale-105 shadow-xl ring-4 ring-orange-500/10' 
              : 'border-slate-200 bg-slate-50/50 hover:border-orange-400 hover:bg-[#FFF0EB]/20 shadow-sm'
          }`}
        >
          <input type="file" className="hidden" onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])} accept="image/*" />
          <Plus className={`w-6 h-6 transition-colors ${isDragOver ? 'text-orange-500' : 'text-slate-300 group-hover/upload:text-orange-400'}`} />
          <span className={`text-[10px] font-black mt-1 transition-colors ${isDragOver ? 'text-orange-600' : 'text-slate-400 group-hover/upload:text-orange-500'}`}>{label}</span>
        </label>
      )}
    </div>
  );
};

export default ClothingModificationTab;
