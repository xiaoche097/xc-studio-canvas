import React, { useState } from 'react';
import { Download, Loader2, Sparkles, Upload, Zap, Image as ImageIcon, Cpu, X, Maximize2, Camera, ArrowLeft } from 'lucide-react';
import { compressImage, getErrorMessage } from '../Cyzx4/utils/apiHelpers';
import { AspectRatio, ImageResolution } from '../Cyzx4/types';
import { DollImageEditor, EditorBox } from './components/DollImageEditor';

// --- Cute Angle Presets Configuration ---
const ANGLE_PRESETS = [
  {
    id: 'p01',
    name: '最稳可爱',
    label: '3/4 front view',
    desc: '3/4 侧前方 + 轻俯',
    prompt: 'three-quarter front view, camera slightly above the toy, about 25–30 degrees top-down, face as the focal point, full toy visible, centered composition'
  },
  {
    id: 'p02',
    name: '脸萌最大化',
    label: 'front view',
    desc: '正前方近景 + 微俯',
    prompt: 'front view, slight top-down angle 10–15 degrees, tighter framing, face larger in frame, keep full face and gills visible, no cropping of the head'
  },
  {
    id: 'p03',
    name: '趴趴感',
    label: '60° high angle',
    desc: '半顶视 60°',
    prompt: 'high angle shot about 60 degrees, full toy visible, emphasize rounded head and plush texture, minimal perspective distortion'
  },
  {
    id: 'p04',
    name: '宝宝视角',
    label: 'eye-level',
    desc: '贴地平视 + 微俯',
    prompt: 'low eye-level near tabletop, slight top-down tilt 5–10 degrees (avoid aggressive low-angle), cute “looking up” feel, face sharp, body gently falling out of focus'
  },
  {
    id: 'p05',
    name: '轮廓软糯',
    label: 'side view',
    desc: '侧面 90° + 回头',
    prompt: 'side view about 80–90 degrees, head turned slightly toward camera 15–20 degrees, both eyes and mouth visible, full toy visible'
  },
  {
    id: 'p06',
    name: '引导线更萌',
    label: 'rear view to face',
    desc: '从尾巴方向拍向脸',
    prompt: 'shot from the tail toward the face, gentle leading-line composition along the body, face in foreground, body receding softly, keep tail and body shape unchanged'
  },
  {
    id: 'p07',
    name: '小小一只',
    label: 'full-body far',
    desc: '远景留白 (治愈)',
    prompt: 'full-body shot, lots of negative space, centered composition on pure white, toy appears small and cute'
  },
  {
    id: 'p08',
    name: '45° 俯拍',
    label: '45° top-down',
    desc: '保险角 (稳与萌)',
    prompt: 'three-quarter view, 40–50 degrees top-down, balanced: face prominent but body still readable, minimal shadow'
  }
];

const STRUCTURE_LOCK = `Same exact plush toy as the reference image, keep the original design unchanged, identical proportions and silhouette, same face (two black oval eyes and small w-shaped mouth), same fluffy gills, same raised tail shape, same stitching seams and fabric texture, do not alter the product geometry, no redesign, no deformation, no new elements, no missing parts, no accessories, no color changes.`;

const ECOMMERCE_MODULE = `pure white seamless background, soft even studio lighting, minimal soft shadow directly under the toy, accurate color, sharp focus, high resolution, clean e-commerce product photography.`;

const UNIVERSAL_NEGATIVE = `redesign, different toy, different character, different proportions, different silhouette, different eyes, different mouth, different face, different tail, different gills, different stitching, deformation, warped, melted, stretched, asymmetrical, extra parts, missing parts, mutated, accessories, clothing, props, packaging, background objects, colored background, gray background, harsh shadow, hard shadow, dramatic lighting, reflections, text, watermark, logo, blurry, low quality, cropped, cut off.`;

const DollAnglePresetsTab: React.FC = () => {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(ANGLE_PRESETS[0].id);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-image-preview');
  const [intensity, setIntensity] = useState<'low' | 'medium'>('low'); // low for better consistency
  const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.RES_4K);
  const [variantCount, setVariantCount] = useState(4);
  const [negativeGuidance, setNegativeGuidance] = useState('避免复杂背景、避免暗黑风');
  const [supplementGuidance, setSupplementGuidance] = useState('');
  const [preview, setPreview] = useState<{ src: string, title: string } | null>(null);

  const setSourceFromFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (sourceUrl && sourceUrl.startsWith('blob:')) URL.revokeObjectURL(sourceUrl);
    setSourceFile(file);
    setSourceUrl(URL.createObjectURL(file));
    setResultImages([]);
  };

  const handleSourceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSourceFromFile(file);
    e.target.value = '';
  };

  const handleSourceDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) setSourceFromFile(file);
  };

  const downloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
    } catch (e) {
      window.open(url, '_blank');
    }
  };

  const handleGenerate = async () => {
    if (!sourceFile) {
      alert('请上传玩偶原图');
      return;
    }

    setIsGenerating(true);
    setStatusMessage('正在锁定玩偶结构并转换视角...');

    try {
      const { generateImageToImage } = await import('../Cyzx4/services/geminiService');
      const compressedImage = await compressImage(sourceFile, 2048, 0.96);
      
      const preset = ANGLE_PRESETS.find(p => p.id === selectedPresetId);
      const intensityPrompt = intensity === 'low' 
        ? "STRICT CONSISTENCY: High structural lock, do not change any small features. Keep denoise level low." 
        : "BALANCED: Maintain structure but allow for natural perspective adjustments.";

      const prompt = `[DOLL ANGLE PRESET TRANSFORMATION]\n\n${STRUCTURE_LOCK}\n\nCAMERA ANGLE: ${preset?.prompt}\n\nSTYLE: ${ECOMMERCE_MODULE}\n\n${intensityPrompt}\n\nSTRICT: Maintain 100% design fidelity to the reference image.\n\n${supplementGuidance ? `SUPPLEMENTARY说明: ${supplementGuidance}` : ''}`;
      
      const negPrompt = `${UNIVERSAL_NEGATIVE}${negativeGuidance ? `, ${negativeGuidance}` : ''}`;

      setStatusMessage(`正在并行为您生成 ${variantCount} 组视角方案 (约 30-60s)...`);

      const generationTasks = Array(variantCount).fill(null).map(() => 
        generateImageToImage(
          [{ base64: compressedImage.base64, mimeType: compressedImage.mime }],
          prompt,
          {
            aspectRatio: AspectRatio.SQUARE,
            resolution: resolution,
            modelId: selectedModel,
            negativePrompt: negPrompt,
            workflowHint: 'doll-modification',
            sampleCount: 1
          }
        )
      );

      const allResults = await Promise.all(generationTasks);
      const flattenedResult = allResults.flat().filter(img => !!img);

      if (flattenedResult.length > 0) {
        setResultImages(flattenedResult);
        setSelectedResultIndex(0);
      } else {
        throw new Error('未返回任何图片');
      }
    } catch (err: any) {
      console.error(err);
      alert(getErrorMessage(err));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-pastel-bg text-pastel-text">
      {/* Sidebar Controls */}
      <div className="w-full md:w-1/3 lg:w-[500px] flex flex-col border-r border-pastel-border bg-pastel-card overflow-y-auto custom-scrollbar shadow-sm">
        <div className="p-6 space-y-8 flex-1">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-pastel-highlight">
              <Camera className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Angle Transformation</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight">可爱角度转变</h2>
            <p className="text-xs leading-relaxed text-pastel-muted italic">
              改变相机视角而保持玩偶结构 100% 一致。建议生成后从中挑选最完美的一张。
            </p>
          </div>

          {/* Original Image */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold flex items-center justify-between">
              基础玩偶原图
              <span className="text-[10px] font-normal text-red-400">必须上传</span>
            </h3>
            {sourceUrl ? (
              <div 
                className="relative group w-full aspect-square rounded-3xl border border-pastel-border shadow-sm overflow-hidden bg-white p-4"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleSourceDrop}
              >
                <img src={sourceUrl} alt="source" className="w-full h-full object-contain rounded-xl" />
                <button 
                  onClick={() => { setSourceUrl(null); setSourceFile(null); }}
                  className="absolute top-4 right-4 bg-black/60 text-white p-1.5 rounded-full hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100 shadow-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label 
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleSourceDrop}
                className="flex flex-col items-center justify-center w-full aspect-square rounded-3xl border-2 border-dashed border-pastel-border bg-white hover:bg-pastel-highlight/5 hover:border-pastel-highlight transition-all cursor-pointer group"
              >
                <input type="file" className="hidden" onChange={handleSourceChange} accept="image/*" />
                <div className="w-14 h-14 mb-4 bg-pastel-bg rounded-2xl flex items-center justify-center text-pastel-muted group-hover:text-pastel-highlight transition-colors shadow-sm">
                  <Upload className="w-7 h-7" />
                </div>
                <span className="text-sm font-bold">点击或拖拽原图</span>
                <span className="text-[10px] mt-2 text-pastel-muted">保持一致性优先</span>
              </label>
            )}
          </div>

          {/* Presets */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-pastel-highlight" />
              视角预设 (Angle Presets)
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {ANGLE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setSelectedPresetId(preset.id)}
                  className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden group ${
                    selectedPresetId === preset.id 
                      ? 'border-pastel-highlight bg-pastel-highlight/5 shadow-md ring-1 ring-pastel-highlight' 
                      : 'border-pastel-border bg-white hover:border-pastel-highlight/40'
                  }`}
                >
                  <div className={`text-[11px] font-black mb-1 ${selectedPresetId === preset.id ? 'text-pastel-highlight' : 'text-pastel-text'}`}>
                    {preset.name}
                  </div>
                  <div className="text-[9px] text-pastel-muted leading-tight line-clamp-2">
                    {preset.desc}
                  </div>
                  {selectedPresetId === preset.id && (
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-pastel-highlight text-white flex items-center justify-center rounded-tl-xl">
                      <Zap className="w-3 h-3 fill-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Consistency Lock & Quality */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-pastel-muted uppercase tracking-widest">一致性强度</label>
              <div className="flex p-1 bg-white border border-pastel-border rounded-xl">
                <button 
                  onClick={() => setIntensity('low')}
                  className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${intensity === 'low' ? 'bg-pastel-highlight text-white' : 'text-pastel-muted hover:bg-pastel-bg'}`}
                >
                  保守
                </button>
                <button 
                  onClick={() => setIntensity('medium')}
                  className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${intensity === 'medium' ? 'bg-pastel-highlight text-white' : 'text-pastel-muted hover:bg-pastel-bg'}`}
                >
                  均衡
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-pastel-muted uppercase tracking-widest">变体数量</label>
              <div className="flex p-1 bg-white border border-pastel-border rounded-xl">
                {[1, 2, 4].map((num) => (
                  <button
                    key={num}
                    onClick={() => setVariantCount(num)}
                    className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${variantCount === num ? 'bg-pastel-highlight text-white' : 'text-pastel-muted hover:bg-pastel-bg'}`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold flex items-center justify-between">
              输出画质
            </h3>
            <select 
              value={resolution}
              onChange={(e) => setResolution(e.target.value as ImageResolution)}
              className="w-full bg-white border border-pastel-border rounded-xl py-2.5 px-3 text-xs font-bold outline-none"
            >
              <option value={ImageResolution.RES_2K}>2K (快速清晰)</option>
              <option value={ImageResolution.RES_4K}>4K (极致细节)</option>
            </select>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-pastel-muted mb-2">禁忌元素</h3>
              <input
                type="text"
                value={negativeGuidance}
                onChange={(e) => setNegativeGuidance(e.target.value)}
                placeholder="例如：避免复杂背景、避免暗黑风"
                className="w-full bg-white border border-pastel-border rounded-xl py-2.5 px-4 text-xs focus:ring-2 focus:ring-pastel-highlight/20 outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold text-pastel-muted mb-2">补充说明</h3>
              <textarea
                rows={3}
                value={supplementGuidance}
                onChange={(e) => setSupplementGuidance(e.target.value)}
                placeholder="更多运营信息、参考关键词、希望突出的镜头语言等"
                className="w-full bg-white border border-pastel-border rounded-xl py-3 px-4 text-xs focus:ring-2 focus:ring-pastel-highlight/20 outline-none placeholder-gray-400 resize-none transition-all"
              />
            </div>

            <div className="bg-white p-4 rounded-xl border border-pastel-border shadow-sm space-y-3">
              <label className="block text-[10px] font-black text-pastel-muted uppercase tracking-widest flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" /> 图像模型选择
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSelectedModel('gemini-3.1-flash-image-preview')}
                  className={`py-2 rounded-xl border text-[10px] font-bold transition-all ${selectedModel === 'gemini-3.1-flash-image-preview' ? 'border-purple-400 bg-purple-50 text-purple-700' : 'border-pastel-border text-pastel-muted'}`}
                >
                  3.1 Flash (极速)
                </button>
                <button
                  onClick={() => setSelectedModel('gemini-3-pro-image-preview')}
                  className={`py-2 rounded-xl border text-[10px] font-bold transition-all ${selectedModel === 'gemini-3-pro-image-preview' ? 'border-purple-400 bg-purple-50 text-purple-700' : 'border-pastel-border text-pastel-muted'}`}
                >
                  3.0 Pro (稳定)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <div className="p-6 border-t border-pastel-border bg-white/50 backdrop-blur-sm sticky bottom-0 z-10">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !sourceFile}
            className="w-full py-4 bg-gradient-to-r from-pastel-highlight to-pink-500 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-pastel-highlight/20 hover:shadow-pastel-highlight/40 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isGenerating ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> 正在视角转换...</>
            ) : (
              <><Zap className="h-5 w-5 fill-white" /> 立即生成批量角度 ({variantCount}张)</>
            )}
          </button>
        </div>
      </div>

      {/* Main Content (Results Area) */}
      <div className="flex-1 flex flex-col p-8 overflow-hidden relative items-center justify-center">
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center gap-6 p-16 bg-white/60 backdrop-blur-xl rounded-[48px] border border-white shadow-2xl max-w-lg w-full">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-pastel-highlight/20 border-t-pastel-highlight animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Camera className="w-8 h-8 text-pastel-highlight" />
              </div>
            </div>
            <div className="text-center space-y-4">
              <h3 className="text-2xl font-black text-pastel-highlight">正在锁定玩偶结构...</h3>
              <p className="text-pastel-text/80 text-sm font-medium animate-pulse">
                {statusMessage}
              </p>
            </div>
          </div>
        ) : resultImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-pastel-muted/40 h-full w-full">
             <div className="w-32 h-32 rounded-[48px] bg-white border-2 border-dashed border-pastel-border flex items-center justify-center mb-8 shadow-sm">
               <Camera className="w-12 h-12" />
             </div>
             <p className="text-xl font-black text-pastel-text/60">等待生成视角预设</p>
             <p className="text-xs mt-3 opacity-60 max-w-xs text-center leading-relaxed font-medium">请在左侧上传玩偶底图并选择一个角度预设。系统将自动生成变体供您挑选。</p>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-6 animate-in fade-in zoom-in-95 duration-500">
            <div className="flex items-center justify-between w-full max-w-4xl bg-white/60 backdrop-blur-md p-4 rounded-3xl border border-white shadow-sm">
               <div className="flex items-center gap-4">
                 <div className="bg-pastel-highlight/10 p-2 rounded-xl">
                   <Sparkles className="w-5 h-5 text-pastel-highlight" />
                 </div>
                 <div>
                   <h3 className="text-sm font-black text-pastel-text">生成方案挑选</h3>
                   <p className="text-[10px] text-pastel-muted">系统已生成 {resultImages.length} 组变体，请点击下方缩略图切换预览</p>
                 </div>
               </div>
               
               <div className="flex items-center gap-2 flex-shrink-0 z-30">
                  {resultImages.map((img, idx) => (
                    <button 
                      key={idx}
                      onClick={() => setSelectedResultIndex(idx)}
                      className={`w-12 h-12 rounded-xl border-2 overflow-hidden transition-all duration-300 flex-shrink-0 ${selectedResultIndex === idx ? 'border-pastel-highlight scale-110 shadow-lg' : 'border-pastel-border opacity-60 hover:opacity-100 shadow-sm'}`}
                    >
                      <img src={img} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
            </div>
            
            <div className="relative group flex-1 w-full max-w-4xl flex items-center justify-center">
              <div 
                className="relative w-full h-full bg-white rounded-[40px] shadow-2xl border-4 border-white overflow-hidden transition-all group-hover:shadow-pastel-highlight/10"
              >
                <img
                  src={resultImages[selectedResultIndex]}
                  alt="Doll Angle Result"
                  className="w-full h-full object-contain bg-slate-50"
                />
                <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
                   <button 
                     onClick={() => setSelectedResultIndex(prev => (prev - 1 + resultImages.length) % resultImages.length)}
                     className={`p-3 bg-white/90 rounded-full shadow-xl pointer-events-auto transition-all hover:scale-110 active:scale-90 ${resultImages.length <= 1 ? 'hidden' : 'flex'}`}
                   >
                     <ArrowLeft className="w-6 h-6 text-pastel-text" />
                   </button>
                   <button 
                     onClick={() => setSelectedResultIndex(prev => (prev + 1) % resultImages.length)}
                     className={`p-3 bg-white/90 rounded-full shadow-xl pointer-events-auto transition-all hover:scale-110 active:scale-90 ${resultImages.length <= 1 ? 'hidden' : 'flex'}`}
                   >
                     <ArrowLeft className="w-6 h-6 text-pastel-text rotate-180" />
                   </button>
                </div>

                <div className="absolute inset-0 bg-black/0 hover:bg-black/5 transition-all flex items-center justify-center gap-4 group">
                   <button
                     onClick={() => setPreview({ src: resultImages[selectedResultIndex], title: `角度预设变体 #${selectedResultIndex + 1}` })}
                     className="bg-white/95 p-4 rounded-full shadow-2xl opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-95"
                   >
                     <Maximize2 className="w-6 h-6 text-pastel-text" />
                   </button>
                   <button
                     onClick={() => downloadImage(resultImages[selectedResultIndex], `doll-angle-${Date.now()}.png`)}
                     className="bg-pastel-highlight p-4 rounded-full shadow-2xl opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-95 text-white"
                   >
                     <Download className="w-6 h-6" />
                   </button>
                </div>
              </div>
              
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-6 py-3 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-pastel-border z-30">
                <div className="w-2 h-2 rounded-full bg-pastel-highlight animate-pulse" />
                <span className="text-[10px] font-black text-pastel-text uppercase tracking-widest">变体 {selectedResultIndex + 1} / {resultImages.length}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 p-8 backdrop-blur-2xl animate-in fade-in duration-300" onClick={() => setPreview(null)}>
          <button type="button" onClick={() => setPreview(null)} className="absolute right-8 top-8 rounded-full border border-white/10 bg-white/5 p-4 text-white transition-all hover:bg-white/10 hover:scale-110 active:scale-95 shadow-2xl">
            <X className="h-8 w-8" />
          </button>

          <div className="relative flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-[48px] border border-white/10 bg-[#0f172a] shadow-[0_80px_160px_rgba(0,0,0,0.7)] animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-6 border-b border-white/10 px-10 py-8 text-white bg-white/5 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-pastel-highlight flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="text-2xl font-black tracking-tight">{preview.title}</h4>
                  <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest">Ultra-High Quality Preview</p>
                </div>
              </div>
              <button
                onClick={() => downloadImage(preview.src, `doll-ultra-${Date.now()}.png`)}
                className="flex items-center gap-3 rounded-2xl bg-pastel-highlight px-8 py-4 text-sm font-black text-white hover:bg-orange-600 transition-all active:scale-95 shadow-xl shadow-orange-500/20"
              >
                <Download className="h-5 w-5" /> 下载高清原图
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:24px_24px] p-12 flex items-center justify-center">
              <img src={preview.src} alt="Preview" className="max-w-full max-h-full object-contain shadow-2xl rounded-2xl border-4 border-white/5" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DollAnglePresetsTab;
