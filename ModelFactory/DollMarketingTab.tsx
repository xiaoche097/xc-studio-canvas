import React, { useState } from 'react';
import { Upload, X, Zap, Loader2, Maximize2, RefreshCw, Download, Ratio, Box, Sparkles, MonitorSmartphone, Palette, Heart, LayoutList, Flame } from 'lucide-react';
import { AspectRatio, ImageResolution } from '../Cyzx4/types';
import { generateImageToImage } from '../Cyzx4/services/geminiService';
import { compressImage, getErrorMessage } from '../Cyzx4/utils/apiHelpers';

type MarketingType = 'heating' | 'lifestyle' | 'feature-summary';

const DollMarketingTab: React.FC = () => {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [marketingType, setMarketingType] = useState<MarketingType>('heating');
  const [outputAspectRatio, setOutputAspectRatio] = useState<AspectRatio>(AspectRatio.PORTRAIT_3_4);
  const [resolution, setResolution] = useState<ImageResolution>(ImageResolution.RES_2K);
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

  const buildMarketingPrompt = (type: MarketingType) => {
    const baseAesthetic = `
- STYLE: Warm Healing System, Minimalist Premium (温暖治愈系·极简高级).
- PALETTE: Cream Rice White (#F6F2ED), Warm Apricot (#F3E4D7), Lavender (#BFAEDC), Warm Orange (#F5B27A).
- TYPOGRAPHY STYLE: Premium, clean sans-serif (Poppins/Montserrat style).
- VIBE: Soft, Calm, Premium, Clean, Trust.
- QUALITY: High-end Amazon secondary image, commercial photography.`;

    if (type === 'heating') {
      return `[AMAZON SECONDARY IMAGE - HEATING FUNCTION]
${baseAesthetic}
- COMPOSITION: Product is the HERO (70% of frame). Weakened microwave in background (only partial view).
- CONTENT: Show a "Microwaveable Warm Plush".
- TEXT ELEMENTS: 
  * Main Title: "Microwaveable Warm Plush"
  * Subtitle: "Instant Soothing Heat for Your Body & Mind"
- ICONS: 3 horizontal minimal icons representing "Heat Therapy", "Relax Muscles", "Reduce Stress".
- GOAL: Focus on "Healing/Soothing" rather than "Medical".`;
    }

    if (type === 'lifestyle') {
      return `[AMAZON SECONDARY IMAGE - LIFESTYLE SCENARIO]
${baseAesthetic}
- COMPOSITION: Lifestyle shot. Person holding/cuddling the plush toy. Person + Product occupy 80% of frame.
- BACKGROUND: Unified Cream Rice White, minimalist environment.
- CONTENT: "Your Everyday Comfort Companion".
- VIBE: Emotional value, cozy, "I want to own this" feeling.
- TEXT: "Warmth · Softness · Gentle Pressure. Perfect for Work, Rest & Relaxation".
- CONSTRAINT: NO cartoon icons, NO dashed lines.`;
    }

    return `[AMAZON SECONDARY IMAGE - FEATURE SUMMARY]
${baseAesthetic}
- COMPOSITION: Split layout (Left/Right). Left: Clean, high-fidelity hero shot of the product. Right: 4 info cards.
- CONTENT: "Designed for Comfort & Care".
- FEATURE CARDS: 
  1. Ultra Soft Plush Fabric
  2. Even Heat Distribution
  3. Gentle Weighted Feel
  4. Safe & Easy to Use
- ICONS: Each feature has a clean, linear, minimal icon.
- GOAL: High-end information card, clean and trustworthy.`;
  };

  const handleGenerate = async () => {
    if (!sourceFile) {
      alert('请先上传玩偶设计原图');
      return;
    }

    setIsGenerating(true);
    try {
      const compressed = await compressImage(sourceFile, 2048, 0.96);
      const prompt = buildMarketingPrompt(marketingType);

      const res = await generateImageToImage(
        [{ base64: compressed.base64, mimeType: compressed.mime }],
        prompt,
        {
          aspectRatio: outputAspectRatio,
          resolution,
          workflowHint: 'doll-marketing',
          negativePrompt: 'cartoon icons, messy text, dashed lines, medical look, low end, cheap collage, plastic texture, cluttered background'
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
              <Sparkles className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Doll Marketing</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight">亚马逊副图优化</h2>
            <p className="text-xs text-pastel-muted leading-relaxed">
              基于欧美审美与高转化逻辑，一键生成温暖治愈系的专业营销副图。
            </p>
          </div>

          {/* Marketing Type Selection */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black text-pastel-muted uppercase tracking-widest flex items-center gap-1.5">
              <LayoutList className="w-3 h-3" />
              选择图片类型 (营销路径)
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {[
                { id: 'heating', label: '微波加热功能图', desc: '核心卖点 · 治愈系功能', icon: <Flame className="w-4 h-4" /> },
                { id: 'lifestyle', label: '生活场景情绪图', desc: '情绪价值 · 陪伴感场景', icon: <Heart className="w-4 h-4" /> },
                { id: 'feature-summary', label: '功能总结收口图', desc: '转化收口 · 专业信息卡', icon: <Box className="w-4 h-4" /> },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setMarketingType(item.id as any)}
                  className={`flex items-center gap-3 p-4 rounded-2xl border transition-all text-left group ${
                    marketingType === item.id 
                      ? 'bg-pastel-highlight/10 border-pastel-highlight text-pastel-highlight ring-2 ring-pastel-highlight/5' 
                      : 'bg-white border-pastel-border text-pastel-muted hover:border-pastel-highlight/40'
                  }`}
                >
                  <div className={`p-2 rounded-xl transition-colors ${marketingType === item.id ? 'bg-pastel-highlight text-white' : 'bg-pastel-bg text-pastel-muted group-hover:text-pastel-highlight'}`}>
                    {item.icon}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-black">{item.label}</div>
                    <div className="text-[10px] opacity-60 mt-0.5">{item.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Source Upload */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black text-pastel-muted uppercase tracking-widest flex items-center gap-1.5">
              <Upload className="w-3 h-3" />
              玩偶原图 (设计成果图)
            </h3>
            {sourceUrl ? (
              <div className="relative group rounded-2xl border border-pastel-border overflow-hidden bg-white aspect-[4/3] shadow-sm">
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
              <label className="flex flex-col items-center justify-center aspect-[4/3] rounded-2xl border-2 border-dashed border-pastel-border bg-white hover:bg-pastel-highlight/5 hover:border-pastel-highlight transition-all cursor-pointer group">
                <input type="file" className="hidden" onChange={handleFileChange} />
                <div className="w-12 h-12 mb-3 bg-pastel-bg rounded-2xl flex items-center justify-center text-pastel-muted group-hover:text-pastel-highlight transition-colors shadow-inner">
                  <ImageIcon size={24} />
                </div>
                <span className="text-sm font-black text-center px-4">上传优化后的玩偶主图</span>
                <span className="text-[10px] text-pastel-muted mt-2">系统将基于此图生成营销海报</span>
              </label>
            )}
          </div>

          {/* Advanced Settings */}
          <div className="space-y-6 pt-4 border-t border-pastel-border">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-pastel-muted uppercase tracking-widest">比例 (Amazon)</label>
                <select 
                  value={outputAspectRatio}
                  onChange={(e) => setOutputAspectRatio(e.target.value as any)}
                  className="w-full p-2.5 bg-white border border-pastel-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-pastel-highlight/10 transition-all"
                >
                  <option value={AspectRatio.SQUARE}>1:1 (Main Image)</option>
                  <option value={AspectRatio.PORTRAIT_3_4}>3:4 (Secondary)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-pastel-muted uppercase tracking-widest">分辨率</label>
                <select 
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as any)}
                  className="w-full p-2.5 bg-white border border-pastel-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-pastel-highlight/10 transition-all"
                >
                  <option value={ImageResolution.RES_2K}>2K (HD)</option>
                  <option value={ImageResolution.RES_4K}>4K (Ultra)</option>
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
                正在生成高转化副图...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 fill-white" />
                立即生成亚马逊副图
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
              <MonitorSmartphone className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-pastel-text mb-2">等待营销图生成</h3>
            <p className="text-xs max-w-[200px] text-center">系统将基于“温暖治愈系”视觉规范，自动完成构图、文案与配色。</p>
          </div>
        ) : (
          <div className="relative max-w-2xl w-full aspect-[3/4] bg-white rounded-3xl shadow-2xl border border-pastel-border overflow-hidden group animate-in zoom-in-95 duration-500">
            {isGenerating ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10">
                <div className="w-12 h-12 rounded-full border-4 border-pastel-highlight/20 border-t-pastel-highlight animate-spin mb-4" />
                <p className="text-sm font-black text-pastel-highlight uppercase tracking-widest animate-pulse">Designing Marketing Asset...</p>
              </div>
            ) : null}
            
            {resultImage && (
              <>
                <img src={resultImage} className="w-full h-full object-contain" alt="result" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                  <button onClick={() => setPreview(resultImage)} className="p-3 bg-white rounded-full hover:scale-110 transition-transform shadow-xl">
                    <Maximize2 className="w-5 h-5 text-pastel-text" />
                  </button>
                  <a href={resultImage} download="amazon_marketing.png" className="p-3 bg-pastel-highlight rounded-full hover:scale-110 transition-transform shadow-xl text-white">
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

export default DollMarketingTab;
