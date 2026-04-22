import React, { useState, useRef } from 'react';
import { Upload, X, Maximize2, Calculator, Image as ImageIcon, Ruler } from 'lucide-react';

interface RatioData {
  ratio: string;
  width: number;
  height: number;
  pixelWidth: number;
  pixelHeight: number;
  previewUrl: string;
}

const AspectRatioTab: React.FC = () => {
  const [data, setData] = useState<RatioData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const gcd = (a: number, b: number): number => {
    return b === 0 ? a : gcd(b, a % b);
  };

  const getSimplifiedRatio = (width: number, height: number): string => {
    // Standard ratios to check against
    const standards = [
      { w: 1, h: 1, label: '1:1' },
      { w: 4, h: 5, label: '4:5' },
      { w: 5, h: 4, label: '5:4' },
      { w: 3, h: 4, label: '3:4' },
      { w: 4, h: 3, label: '4:3' },
      { w: 2, h: 3, label: '2:3' },
      { w: 3, h: 2, label: '3:2' },
      { w: 9, h: 16, label: '9:16' },
      { w: 16, h: 9, label: '16:9' },
      { w: 21, h: 9, label: '21:9' },
    ];

    const currentRatio = width / height;
    let closest = standards[0];
    let minDiff = Math.abs(currentRatio - closest.w / closest.h);

    for (const std of standards) {
      const diff = Math.abs(currentRatio - std.w / std.h);
      if (diff < minDiff) {
        minDiff = diff;
        closest = std;
      }
    }

    // If it's very close to a standard, return the standard label
    if (minDiff < 0.02) {
      return closest.label;
    }

    // Otherwise calculate the actual GCD
    const common = gcd(width, height);
    return `${width / common}:${height / common}`;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('请上传有效的图片文件');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const w = img.width;
          const h = img.height;
          const ratioLabel = getSimplifiedRatio(w, h);
          const [rwStr, rhStr] = ratioLabel.split(':');
          const rw = Number(rwStr);
          const rh = Number(rhStr);

          setData({
            ratio: ratioLabel,
            width: rw || 1,
            height: rh || 1,
            pixelWidth: w,
            pixelHeight: h,
            previewUrl: event.target?.result as string
          });
          setIsAnalyzing(false);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError('分析图片时出错');
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8 animate-fade-in">
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-pastel-pink p-2 rounded-lg">
          <Calculator className="w-6 h-6 text-pastel-highlight" />
        </div>
        <h2 className="text-2xl font-bold text-pastel-text">比例查询 (Aspect Ratio Query)</h2>
      </div>

      {!data ? (
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="group relative h-96 border-2 border-dashed border-pastel-border rounded-3xl bg-white hover:bg-pastel-bg hover:border-pastel-highlight transition-all duration-300 cursor-pointer flex flex-col items-center justify-center gap-4 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-pastel-pink/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="bg-pastel-pink/20 p-6 rounded-full group-hover:scale-110 transition-transform duration-500">
            <Upload className="w-12 h-12 text-pastel-highlight" />
          </div>
          
          <div className="text-center space-y-2 z-10">
            <p className="text-xl font-medium text-pastel-text">点击或拖拽图片进行比例分析</p>
            <p className="text-sm text-pastel-muted">支持 JPG, PNG, WEBP 格式</p>
          </div>

          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden" 
            accept="image/*"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Form-like UI */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-pastel-border shadow-sm space-y-8">
              {/* Category */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-pastel-muted ml-1">类别</label>
                <div className="w-full bg-pastel-bg border border-pastel-border rounded-xl px-4 py-3 text-pastel-text font-medium">
                  自定义
                </div>
              </div>

              {/* Presets */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-pastel-muted ml-1">常用预设</label>
                <div className="w-full bg-pastel-bg border border-pastel-border rounded-xl px-4 py-3 text-pastel-text font-medium">
                  自定义
                </div>
              </div>

              {/* Ratio Values */}
              <div className="grid grid-cols-2 gap-6 items-end">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-pastel-muted ml-1">宽度 *</label>
                  <input 
                    type="text" 
                    readOnly
                    value={data.width}
                    className="w-full bg-white border border-pastel-border rounded-xl px-4 py-4 text-pastel-text font-bold text-xl"
                  />
                </div>
                <div className="flex justify-center pb-4">
                  <X className="text-pastel-muted w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-pastel-muted ml-1">高度 *</label>
                  <input 
                    type="text" 
                    readOnly
                    value={data.height}
                    className="w-full bg-white border border-pastel-border rounded-xl px-4 py-4 text-pastel-text font-bold text-xl"
                  />
                </div>
              </div>

              {/* Pixel Values */}
              <div className="grid grid-cols-2 gap-6 items-end pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-pastel-muted ml-1">像素宽度 *</label>
                  <input 
                    type="text" 
                    readOnly
                    value={data.pixelWidth}
                    className="w-full bg-white border border-pastel-border rounded-xl px-4 py-4 text-pastel-text font-bold text-xl"
                  />
                </div>
                <div className="flex justify-center pb-4">
                  <X className="text-pastel-muted w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-pastel-muted ml-1">像素高度 *</label>
                  <input 
                    type="text" 
                    readOnly
                    value={data.pixelHeight}
                    className="w-full bg-white border border-pastel-border rounded-xl px-4 py-4 text-pastel-text font-bold text-xl"
                  />
                </div>
              </div>

              <button 
                onClick={() => setData(null)}
                className="w-full bg-pastel-highlight text-white py-4 rounded-xl font-bold text-lg shadow-md hover:bg-orange-600 transition-all flex items-center justify-center gap-2"
              >
                重新查询
              </button>
            </div>
          </div>

          {/* Right Column: Visualization */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="w-full bg-white p-8 rounded-3xl border border-pastel-border shadow-sm flex flex-col items-center">
              <h3 className="text-xl font-bold text-pastel-text mb-6 flex items-center gap-2 self-start">
                纵横比率: 
                <span 
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', data.ratio);
                  }}
                  onClick={() => {
                    navigator.clipboard.writeText(data.ratio);
                    // Optional: show a temporary toast or change icon
                    const target = document.getElementById('copy-hint');
                    if (target) {
                      target.innerText = '已复制!';
                      setTimeout(() => target.innerText = '点击复制 / 拖拽', 2000);
                    }
                  }}
                  className="text-pastel-highlight cursor-move hover:scale-105 transition-transform bg-pastel-pink/10 px-3 py-1 rounded-lg border border-pastel-highlight/20 select-none group/ratio relative"
                  title="点击复制，拖拽使用"
                >
                  {data.ratio}
                  <span id="copy-hint" className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover/ratio:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    点击复制 / 拖拽
                  </span>
                </span>
              </h3>
              
              {/* Visual Box */}
              <div className="relative w-full aspect-square bg-pastel-bg rounded-2xl flex items-center justify-center p-8 overflow-hidden">
                <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(#ff6b6b 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                
                <div 
                  className="bg-pastel-pink/30 border-2 border-pastel-highlight rounded-xl flex items-center justify-center shadow-lg transition-all duration-700 animate-scale-up"
                  style={{
                    width: data.width >= data.height ? '100%' : `${(data.width / data.height) * 100}%`,
                    height: data.height >= data.width ? '100%' : `${(data.height / data.width) * 100}%`,
                    maxHeight: '100%',
                    maxWidth: '100%'
                  }}
                >
                  <span className="text-4xl md:text-5xl font-black text-white drop-shadow-md">
                    {data.ratio}
                  </span>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-4 w-full">
                <div className="bg-pastel-bg p-4 rounded-2xl border border-pastel-border text-center">
                  <div className="text-xs font-bold text-pastel-muted uppercase">方向</div>
                  <div className="text-lg font-bold text-pastel-text">
                    {data.pixelWidth > data.pixelHeight ? '横屏 (Landscape)' : data.pixelWidth < data.pixelHeight ? '竖屏 (Portrait)' : '正方形 (Square)'}
                  </div>
                </div>
                <div className="bg-pastel-bg p-4 rounded-2xl border border-pastel-border text-center">
                  <div className="text-xs font-bold text-pastel-muted uppercase">建议用途</div>
                  <div className="text-lg font-bold text-pastel-text">
                    {data.ratio === '9:16' ? 'TikTok / Reels' : data.ratio === '4:5' ? 'Instagram' : data.ratio === '16:9' ? 'YouTube / HD' : '电商详情页'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-8 right-8 bg-red-50 border border-red-200 text-red-600 px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 animate-slide-up">
          <ImageIcon className="w-5 h-5" />
          <span className="font-medium">{error}</span>
          <button onClick={() => setError(null)} className="ml-2 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default AspectRatioTab;
