import React, { useState } from 'react';
import { Upload, X, Zap, Loader2, Maximize2, RefreshCw, Download, Ratio, Box, Sparkles, MonitorSmartphone, Cpu } from 'lucide-react';
import { AspectRatio, ImageResolution } from '../Cyzx4/types';
import { generateImageToImage } from '../Cyzx4/services/geminiService';
import { compressImage, getErrorMessage } from '../Cyzx4/utils/apiHelpers';

const DollAdjustmentTab: React.FC = () => {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [angle, setAngle] = useState<'front' | 'left' | 'right'>('front');
  const [stylePreset, setStylePreset] = useState<'standard' | 'warm-healing'>('warm-healing');
  const [outputAspectRatio, setOutputAspectRatio] = useState<AspectRatio>(AspectRatio.SQUARE);
  const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.RES_2K);
  const [userGuidance, setUserGuidance] = useState('');
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      setSourceFile(file);
      setSourceUrl(URL.createObjectURL(file));
      setResultImage(null);
    }
  };

  const handleGenerate = async () => {
    if (!sourceFile) {
      alert('请先上传玩偶原图或草图');
      return;
    }

    setIsGenerating(true);
    try {
      const compressed = await compressImage(sourceFile, 2048, 0.96);
      
      const angleText = angle === 'front' ? 'FRONT VIEW' : angle === 'left' ? '3/4 FRONT-LEFT VIEW' : '3/4 FRONT-RIGHT VIEW';
      
      let styleInstruction = '';
      if (stylePreset === 'warm-healing') {
        styleInstruction = `
- AESTHETIC: Warm Healing System, Minimalist Premium (温暖治愈系·极简高级).
- COLORS: Main: Cream Rice White (#F6F2ED), Accents: Warm Apricot (#F3E4D7), Lavender (#BFAEDC), Warm Orange (#F5B27A).
- KEYWORDS: Soft, Calm, Premium, Clean, Trust, Photorealistic, 8k resolution.
- LIGHTING: Soft studio lighting, gentle shadows.`;
      } else {
        styleInstruction = `
- AESTHETIC: Standard Commercial Product Photography.
- STYLE: Clean, bright, realistic textures, high contrast.`;
      }

      const prompt = `[NANO BANANA - DOLL DESIGN OPTIMIZATION]
- TASK: Transform the provided sketch/photo into a professional, high-end commercial plush toy/doll product image.
- ANGLE: ${angleText}.
${styleInstruction}
- FIDELITY: Maintain the core character design, proportions, and features from the input.
- ENHANCEMENT: Add realistic fur texture, clean stitching details, and expressive 3D depth.
${userGuidance ? `- USER GUIDANCE: ${userGuidance}` : ''}
- OUTPUT: Commercial grade marketing asset.`;

      const res = await generateImageToImage(
        [{ base64: compressed.base64, mimeType: compressed.mime }],
        prompt,
        {
          aspectRatio: outputAspectRatio,
          resolution,
          workflowHint: 'doll-adjustment',
          negativePrompt: 'sketchy lines, messy background, low quality, distorted anatomy, creepy features, plastic look, blurry texture'
        }
      );

      if (res && res.length > 0) {
        setResultImage(res[0]);
      }
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-full bg-pastel-bg overflow-hidden text-pastel-text">
      {/* Sidebar */}
      <div className="w-[400px] border-r border-pastel-border bg-pastel-card flex flex-col overflow-y-auto custom-scrollbar">
        <div className="p-6 space-y-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-pastel-highlight">
              <Box className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Doll Adjustment</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight">玩偶主图调整</h2>
            <p className="text-xs text-pastel-muted leading-relaxed">
              上传基础的玩偶草图或照片，AI 结合提示词为您生成精美、专业的商业展示主图。
            </p>
          </div>

          {/* Source Upload */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black text-pastel-muted uppercase tracking-widest flex items-center gap-1.5">
              <Upload className="w-3 h-3" />
              基础玩偶原图 <span className="text-red-400 font-bold ml-auto">* 必须上传</span>
            </h3>
            {sourceUrl ? (
              <div className="relative group rounded-2xl border border-pastel-border overflow-hidden bg-white aspect-square shadow-sm">
                <img src={sourceUrl} className="w-full h-full object-contain p-4" alt="source" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <label className="p-2.5 bg-white rounded-full cursor-pointer hover:scale-110 transition-transform">
                    <input type="file" className="hidden" onChange={handleFileChange} />
                    <RefreshCw className="w-4 h-4 text-pastel-text" />
                  </label>
                  <button onClick={() => { setSourceFile(null); setSourceUrl(null); }} className="p-2.5 bg-white rounded-full hover:scale-110 transition-transform text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center aspect-square rounded-2xl border-2 border-dashed border-pastel-border bg-white hover:bg-pastel-highlight/5 hover:border-pastel-highlight transition-all cursor-pointer group">
                <input type="file" className="hidden" onChange={handleFileChange} />
                <div className="w-12 h-12 mb-4 bg-pastel-bg rounded-2xl flex items-center justify-center text-pastel-muted group-hover:text-pastel-highlight transition-colors shadow-inner">
                  <ImageIcon size={24} />
                </div>
                <span className="text-sm font-black">点击或拖拽原图到此处</span>
                <span className="text-[10px] text-pastel-muted mt-2">支持 JPG, PNG, WEBP</span>
              </label>
            )}
          </div>

          {/* Angle Selection */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black text-pastel-muted uppercase tracking-widest flex items-center gap-1.5">
              <Ratio className="w-3 h-3" />
              角度锁定 (电商主图预设)
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'left', label: '左前 45°', desc: '3/4 FRONT-LEFT' },
                { id: 'front', label: '正面', desc: 'FRONT VIEW' },
                { id: 'right', label: '右前 45°', desc: '3/4 FRONT-RIGHT' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setAngle(item.id as any)}
                  className={`flex flex-col items-center py-2.5 rounded-xl border transition-all ${
                    angle === item.id 
                      ? 'bg-pastel-highlight/10 border-pastel-highlight text-pastel-highlight ring-2 ring-pastel-highlight/5' 
                      : 'bg-white border-pastel-border text-pastel-muted hover:border-pastel-highlight/40'
                  }`}
                >
                  <span className="text-xs font-bold">{item.label}</span>
                  <span className="text-[8px] opacity-60 uppercase mt-0.5">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Style Preset */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black text-pastel-muted uppercase tracking-widest flex items-center gap-1.5">
              <Palette className="w-3 h-3" />
              视觉风格方向 (欧美高转化逻辑)
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setStylePreset('warm-healing')}
                className={`flex flex-col items-center py-2.5 rounded-xl border transition-all ${
                  stylePreset === 'warm-healing' 
                    ? 'bg-pastel-highlight/10 border-pastel-highlight text-pastel-highlight ring-2 ring-pastel-highlight/5' 
                    : 'bg-white border-pastel-border text-pastel-muted hover:border-pastel-highlight/40'
                }`}
              >
                <span className="text-xs font-bold">温暖治愈系</span>
                <span className="text-[8px] opacity-60 uppercase mt-0.5">Warm & Premium</span>
              </button>
              <button
                onClick={() => setStylePreset('standard')}
                className={`flex flex-col items-center py-2.5 rounded-xl border transition-all ${
                  stylePreset === 'standard' 
                    ? 'bg-pastel-highlight/10 border-pastel-highlight text-pastel-highlight ring-2 ring-pastel-highlight/5' 
                    : 'bg-white border-pastel-border text-pastel-muted hover:border-pastel-highlight/40'
                }`}
              >
                <span className="text-xs font-bold">标准商业</span>
                <span className="text-[8px] opacity-60 uppercase mt-0.5">Standard Clean</span>
              </button>
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="space-y-6 pt-4 border-t border-pastel-border">
            <div className="space-y-3">
              <h3 className="text-[10px] font-black text-pastel-muted uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                内容补充 (DESIGN GUIDANCE)
              </h3>
              <textarea
                value={userGuidance}
                onChange={(e) => setUserGuidance(e.target.value)}
                placeholder="例如：增加长毛绒质感、领口加一个红色蝴蝶结、眼睛做成纽扣样式..."
                className="w-full h-24 p-3 text-xs bg-white border border-pastel-border rounded-xl focus:ring-2 focus:ring-pastel-highlight/20 focus:border-pastel-highlight outline-none transition-all resize-none shadow-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-pastel-muted uppercase">输出比例</label>
                <select 
                  value={outputAspectRatio}
                  onChange={(e) => setOutputAspectRatio(e.target.value as any)}
                  className="w-full p-2.5 bg-white border border-pastel-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-pastel-highlight/10 transition-all"
                >
                  <option value={AspectRatio.SQUARE}>1:1 (Square)</option>
                  <option value={AspectRatio.PORTRAIT_3_4}>3:4 (Portrait)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-pastel-muted uppercase">分辨率</label>
                <select 
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as any)}
                  className="w-full p-2.5 bg-white border border-pastel-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-pastel-highlight/10 transition-all"
                >
                  <option value={ImageResolution.RES_1K}>1K (Fast)</option>
                  <option value={ImageResolution.RES_2K}>2K (HD)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="p-6 mt-auto border-t border-pastel-border bg-white/50 backdrop-blur-sm">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !sourceFile}
            className="w-full py-4 bg-gradient-to-r from-pastel-highlight to-orange-500 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-pastel-highlight/20 hover:shadow-pastel-highlight/40 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                正在智能设计中...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 fill-white" />
                立即生成
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 flex items-center justify-center">
        {!resultImage && !isGenerating ? (
          <div className="flex flex-col items-center justify-center text-pastel-muted">
            <div className="w-24 h-24 mb-6 bg-white rounded-[32px] shadow-sm border-2 border-dashed border-pastel-border flex items-center justify-center opacity-40">
              <Zap className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-pastel-text mb-2">等待生成</h3>
            <p className="text-xs">请在左侧上传玩偶底图并点击生成</p>
          </div>
        ) : (
          <div className="relative max-w-2xl w-full aspect-square bg-white rounded-3xl shadow-2xl border border-pastel-border overflow-hidden group animate-in zoom-in-95 duration-500">
            {isGenerating ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10">
                <div className="w-12 h-12 rounded-full border-4 border-pastel-highlight/20 border-t-pastel-highlight animate-spin mb-4" />
                <p className="text-sm font-black text-pastel-highlight uppercase tracking-widest animate-pulse">Designing Doll...</p>
              </div>
            ) : null}
            
            {resultImage && (
              <>
                <img src={resultImage} className="w-full h-full object-contain" alt="result" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                  <button onClick={() => setPreview(resultImage)} className="p-3 bg-white rounded-full hover:scale-110 transition-transform shadow-xl">
                    <Maximize2 className="w-5 h-5 text-pastel-text" />
                  </button>
                  <a href={resultImage} download="doll_design.png" className="p-3 bg-pastel-highlight rounded-full hover:scale-110 transition-transform shadow-xl text-white">
                    <Download className="w-5 h-5" />
                  </a>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/90 backdrop-blur-md" onClick={() => setPreview(null)}>
          <div className="relative max-w-full max-h-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreview(null)} className="absolute -top-12 right-0 p-2 text-white hover:text-pastel-highlight transition-colors">
              <X size={32} />
            </button>
            <img src={preview} className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl" alt="Preview" />
          </div>
        </div>
      )}
    </div>
  );
};

const ImageIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
    <circle cx="9" cy="9" r="2"/>
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
  </svg>
);

export default DollAdjustmentTab;
